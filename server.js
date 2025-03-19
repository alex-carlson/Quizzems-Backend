import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import sharp from 'sharp';
import Collection from './models/Collection.js';
import User from './models/User.js';
import jwt from 'jsonwebtoken';
import { GridFSBucket } from 'mongodb';

dotenv.config();

const app = express();

app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: "GET, POST, PUT, DELETE",
}));
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error(err));

const conn = mongoose.createConnection(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// Initialize GridFSBucket
let gfs;

conn.once('open', () => {
    const bucket = new mongoose.mongo.GridFSBucket(conn.db, {
        bucketName: 'uploads'  // Specify your collection name (can be 'uploads' or any other)
    });
    gfs = bucket;
    console.log('GridFSBucket Initialized');
});


// Helper function to convert base64 to buffer
const base64ToBuffer = (base64String) => {
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, ''); // Remove metadata if present
    return Buffer.from(base64Data, 'base64');
};

const saveImageToDB = (imageBuffer, filename) => {

    return new Promise((resolve, reject) => {
        // Create a GridFSBucket stream
        const bucket = new GridFSBucket(conn.db, { bucketName: 'uploads' });

        const uploadStream = bucket.openUploadStream(filename, {
            contentType: 'image/jpeg',  // Define the MIME type of the image
        });

        uploadStream.on('finish', () => {
            console.log("Upload finished.");
            resolve(uploadStream.id);  // The uploaded file's _id is available here
        });

        uploadStream.on('error', (err) => {
            console.error('Error uploading image to GridFS:', err);
            reject(err);
        });

        // Pipe the image buffer into the GridFS bucket's upload stream
        uploadStream.end(imageBuffer);
    });
};

const verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(403).json({ message: 'Access Denied: No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;  // Attach user information to the request
        next();  // Proceed to the next middleware or route handler
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

// Signup Route - Register a new user
app.post("/signup", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validate input
        if (!username || !email || !password) {
            console.log("Missing required fields:", username, email, password);
            return res.status(400).json({ error: "Username, email, and password are required." });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            console.log("User already exists:", email);
            return res.status(400).json({ error: "Username already exists" });
        }

        // Create and save the new user
        const user = new User({
            username,
            email,
            password
        });
        await user.save();
        console.log("User created successfully:", user);

        res.status(201).json({ message: "User created successfully!" });
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ error: "An error occurred while creating the user" });
    }
});

// Login Route - Authenticate the user
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ message: "User not found" });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        const JWT_SECRET = process.env.JWT_SECRET;
        const payload = { username: user.username };
        const token = jwt.sign(payload, JWT_SECRET, {
            expiresIn
                : "1h"
        });

        res.status(200).json({ message: "Login successful!", token: token, username: user.username });
    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).json({ message: "Server error", error });
    }
});

app.post("/upload", verifyToken, async (req, res) => {
    try {
        const { category, author, items } = req.body;

        if (!category || !author || !Array.isArray(items) || items.length === 0) {
            return res.status(400).send("Invalid input data");
        }

        // Check if a collection with the same author and category already exists
        const existingCollection = await Collection.findOne({ author, category });

        if (existingCollection) {
            // If a collection exists, remove the old one
            await Collection.deleteOne({ author, category });
            console.log(`Existing collection with ${category} deleted`);
        }

        // Create and save the new collection
        const newCollection = new Collection({
            category,
            author,
            items: processItems(items),
        });

        await newCollection.save();

        res.status(201).send("Image text saved successfully");
        console.log(`New image text saved: ${category}`);
    } catch (error) {
        console.error("Error processing images:", error);
        res.status(500).send("Error processing images");
    }
});

async function processItems(items) {
    return Promise.all(
        items.map(async (item) => {
            if (!item.imageData) return null;

            const imageBuffer = base64ToBuffer(item.imageData);
            const compressedBuffer = await sharp(imageBuffer)
                .resize(400)
                .jpeg({ quality: 50 })
                .toBuffer();

            const fileId = await saveImageToDB(
                compressedBuffer,
                item.answer,
            );
            return { imageUrl: fileId, text: item.answer };
        }),
    ).then((results) => results.filter(Boolean)); // Remove null values
}

// Route to get user's collections
app.get("/user/collections", verifyToken, async (req, res) => {
    console.log("Fetching collections for user:", req.user.username);
    try {
        const userId = req.user.username;  // Get the logged-in user's ID
        console.log("Looking for Collection where author is:", userId);
        const collections = await Collection.find({ author: userId });

        if (!collections || collections.length === 0) {
            return res.status(404).json({ message: "No collections found" });
        }

        res.status(200).json(collections);
    } catch (error) {
        console.error("Error fetching collections:", error);
        res.status(500).json({ message: "Error fetching collections", error });
    }
});

// Backend route to get a single collection's data
app.get("/collections/", verifyToken, async (req, res) => {
    // get all collections
    try {
        const collections = await Collection.find({});
        res.status(200).json(collections);
    } catch (error) {
        console.error("Error fetching collections:", error);
        res.status(500).json({ message: "Error fetching collections" });
    }
});

// Backend route to get a single collection's data
app.get("/collection/:id", async (req, res) => {
    console.log("Fetching collection with ID:", req.params.id);
    try {
        const collectionId = req.params.id;
        const collection = await Collection.findById(collectionId);

        if (!collection) {
            return res.status(404).json({ message: "Collection not found" });
        }

        res.status(200).json(collection);
    } catch (error) {
        console.error("Error fetching collection:", error);
        res.status(500).json({ message: "Error fetching collection" });
    }
});

// Backend route to update the collection
app.post("/update-collection", verifyToken, async (req, res) => {
    try {
        const { category, author, items } = req.body;
        const userId = req.user._id;  // Get the logged-in user's ID

        // Find and update the collection
        const updatedCollection = await Collection.findOneAndUpdate(
            { _id: req.body._id, author: userId },
            { category, author, items },
            { new: true } // Return the updated document
        );

        if (!updatedCollection) {
            return res.status(404).json({ message: "Collection not found or unauthorized" });
        }

        res.status(200).json(updatedCollection);
    } catch (error) {
        console.error("Error updating collection:", error);
        res.status(500).json({ message: "Error updating collection", error });
    }
});

app.get("/image/:id", async (req, res) => {
    try {
        console.log("Fetching image with ID:", req.params.id);

        // Validate ObjectId before using it
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            console.error("Invalid ObjectId:", req.params.id);
            return res.status(400).json({ error: "Invalid image ID" });
        }

        const fileId = new mongoose.Types.ObjectId(req.params.id);
        const downloadStream = gfs.openDownloadStream(fileId);

        // Handle errors from GridFS stream
        downloadStream.on("error", (err) => {
            console.error("GridFS Stream Error:", err);
            res.status(500).json({ error: "Image not found or corrupted" });
        });

        res.setHeader("Content-Type", "image/jpeg"); // Adjust based on file type
        downloadStream.pipe(res);
    } catch (error) {
        console.error("Error fetching image:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Start the server
// if running local
if (process.env.NODE_ENV === 'development') {
    app.listen(5000, () => console.log("Server running on port 5000"));
}
export default app;
