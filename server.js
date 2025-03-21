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

const conn = mongoose.createConnection(process.env.MONGO_URI);

// Helper function to convert base64 to buffer
const base64ToBuffer = (base64String) => {
    console.log("Converting base64 to buffer...");
    // use regex to remove header and data url part of the string
    const base64Image = base64String.replace(/^data:image\/jpeg;base64,/, '');
    return Buffer.from(base64Image, 'base64');
};

const saveImageToDB = (imageBuffer, filename) => {

    return new Promise((resolve, reject) => {
        // Create a GridFSBucket stream
        const bucket = new GridFSBucket(conn.db, { bucketName: 'uploads' });

        // if the bucket already has a file with the same name, return early
        const existingFile = bucket.find({ filename }).toArray();

        if (existingFile.length > 0) {
            console.log("File with the same name already exists:", filename);
            return reject("File with the same name already exists");
        }

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

const processItem = async (category, author, item) => {
    console.log("Processing item...");
    const buffer = base64ToBuffer(item.file);
    const filename = `${author}-${category}-${item.answer}.jpeg`;
    filename.replace(/[^a-zA-Z0-9]/g, '');
    const imageId = await saveImageToDB(buffer, filename);
    // create item schema
    return {
        id: imageId,
        image: filename,
        answer: item.answer
    };
};

const verifyToken = (req, res, next) => {
    console.log("Verifying token...");
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
            expiresIn: '30d'
        });

        res.status(200).json({ message: "Login successful!", token: token, username: user.username });
    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).json({ message: "Server error", error });
    }
});

app.post("/upload", verifyToken, async (req, res) => {
    try {
        // parse the form data to get Category, Author and Item.
        const { category, author, item } = req.body;


        if (!category || !author || item === undefined) {
            return res.status(400).send("Invalid input data");
        }

        // Check if a collection with the same author and category already exists
        const existingCollection = await Collection.findOne({ author, category });

        if (existingCollection) {
            let newItem = await processItem(category, author, item);
            // If a collection exists, add the new item to it
            existingCollection.items.push(newItem);
            await existingCollection.save();
        } else {
            const newItem = await processItem(category, author, item);
            const newCollection = new Collection({
                category,
                author,
                items: [newItem]
            });
            await newCollection.save();
        }


        res.status(201).send("Collection saved successfully");
        console.log(`New collection saved: ${category}`);
    } catch (error) {
        console.error("Error processing collection:", error);
        res.status(500).send("Error processing collection");
    }
});

// Route to get user's collections
app.get("/user/collections", verifyToken, async (req, res) => {
    try {
        const userId = req.user.username;  // Get the logged-in user's ID
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
app.get("/collections", async (req, res) => {
    try {
        const collections = await Collection.find();
        res.status(200).json(collections);
    } catch (error) {
        console.error("Error fetching collections:", error);
        res.status(500).json({ message: "Error fetching collections" });
    }
});

app.post("/update", verifyToken, async (req, res) => {
    try {
        const { collection, id, answer } = req.body;
        const collections = await Collection.findOne({ category: collection });
        if (!collections) {
            return res.status(404).json({ message: "Collection not found" });
        }
        const items = collections.items;
        const updatedItems = items.map(item => {
            if (item.id === id) {
                item.answer = answer;
            }
            return item;
        });
        collections.items = updatedItems;
        await collections.save();
        res.status(200).json(collections);
    } catch (error) {
        console.error("Error fetching collections:", error);
        res.status(500).json({ message: "Error fetching collections" });
    }
});

app.post("/remove", verifyToken, async (req, res) => {
    try {
        const { collection, id } = req.body;
        const collections = await Collection.findOne({ category: collection });
        if (!collections) {
            return res.status(404).json({ message: "Collection not found" });
        }
        const items = collections.items;
        const newItems = items.filter(item => item.id !== id);
        collections.items = newItems;
        await collections.save();
        res.status(200).json(collections);
    } catch (error) {
        console.error("Error fetching collections:", error);
        res.status(500).json({ message: "Error fetching collections" });
    }
});

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

app.get("/image/:id", async (req, res) => {
    const db = mongoose.connection.db;
    const gfs = new GridFSBucket(db, { bucketName: 'uploads' });
    try {
        // Validate ObjectId before using it
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            console.error("Invalid ObjectId:", req.params.id);
            return res.status(400).json({ error: "Invalid image ID" });
        }

        const fileId = new mongoose.Types.ObjectId(req.params.id);
        console.log("Fetching image with ID:", fileId);
        const downloadStream = gfs.openDownloadStream(fileId);

        // Handle errors from GridFS stream
        downloadStream.on("error", (err) => {
            console.error("GridFS Stream Error:", err);
            res.status(404).json({ error: "Image not found or corrupted" });
        });

        downloadStream.pipe(res);
    } catch (error) {
        console.error("Error fetching image:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

const PORT = process.env.PORT || 3000;

// Check if the environment is development or production
if (process.env.NODE_ENV === 'development') {
    // For local development, start the server on localhost:5000
    app.listen(PORT, () => {
        console.log(`🌍 Server running on http://localhost:${PORT}`);
    });
}

// For Vercel deployment (production), export the app as a serverless function
export default app;