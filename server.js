import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Collection from './models/Collection.js';
import User from './models/User.js';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js'; // Ensure you have this file to initialize your Supabase client

dotenv.config();

const app = express();

app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: "GET, POST, PUT, DELETE",
}));
app.use(express.json());

const connectToDatabase = async () => {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("MongoDB connected");
    }
};

const conn = mongoose.createConnection(process.env.MONGO_URI);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const slugify = (text) => {
    //replace spaces with hyphens, convert to lowercase, remove all special characters except / and -
    return text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9/-]/g, '');
};

// Helper function to convert base64 to buffer
const base64ToBuffer = (base64String) => {
    console.log("Converting base64 to buffer...");
    // use regex to remove header and data url part of the string
    const base64Image = base64String.replace(/^data:image\/jpeg;base64,/, '');
    return Buffer.from(base64Image, 'base64');
};

const saveImageToDB = (imageBuffer, filename) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Check if the file already exists in the Supabase storage
            const { data: existingFiles, error: listError } = await supabase
                .storage
                .from('uploads') // 'uploads' is your Supabase bucket name
                .list('', { search: filename, limit: 1 });

            if (listError) {
                console.error("Error checking file existence:", listError);
                return reject(listError);
            }

            if (existingFiles.length > 0) {
                console.log("File with the same name already exists:", filename);
                return reject("File with the same name already exists");
            }

            // Upload the file to Supabase Storage
            const { data, error: uploadError } = await supabase
                .storage
                .from('uploads') // Your Supabase bucket name
                .upload(filename, imageBuffer, {
                    contentType: 'image/jpeg', // Define the MIME type of the image
                    upsert: false // Prevent overwriting existing files with the same name
                });

            if (uploadError) {
                console.error("Error uploading image to Supabase:", uploadError);
                return reject(uploadError);
            }

            console.log("Upload finished.");
            resolve(data);  // 'data' contains the file information, like file name and public URL
        } catch (err) {
            console.error("Error uploading image:", err);
            reject(err);
        }
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
        await connectToDatabase();
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
            return res.status(400).json({ error: "Email already in use" });
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
        await connectToDatabase();
        const { username, email, password } = req.body;

        // if username is not null, find user by username, otherwise find by email
        let user;
        if (email !== "") {
            user = await User.findOne({ email });
        } else {
            user = await User.findOne({ username });
        }

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

app.get("/user", verifyToken, async (req, res) => {
    try {
        await connectToDatabase();
        const user = await User.findOne({ username: req.user.username });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(user);
    } catch (error) {
        // send error message back to user
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Error fetching user" });
    }
});

app.put("/changePassword", verifyToken, async (req, res) => {
    try {
        await connectToDatabase();
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.password = password;
        await user.save();
        res.status(200).json(user);
    } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).json({ message: "Error changing password" });
    }
});

app.delete("/deleteAccount", verifyToken, async (req, res) => {
    try {
        await connectToDatabase();
        const { email } = req.body;
        const user = await User

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        await User.delete({ email });
        res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Error deleting user" })
    }
});

app.post("/upload", verifyToken, async (req, res) => {
    try {
        await connectToDatabase();
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
            existingCollection.slug = slugify(author + "/" + category);
            await existingCollection.save();
        } else {
            const newItem = await processItem(category, author, item);
            const newCollection = new Collection({
                category,
                slug: slugify(author + "/" + category),
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

app.put("/changeUsername", verifyToken, async (req, res) => {
    console.log("Changing username...");
    try {
        await connectToDatabase();
        const { username, email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // find all collections by user and update author
        const collections = await Collection.find({ author: user.username });
        collections.forEach(async collection => {
            collection.author = username;
            collection.slug = slugify(username + "/" + collection.category);
            await collection.save();
        });

        user.username = username;
        await user.save();
        res.status(200).json(user);
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Error fetching user" });
    }
});

// Route to get user's collections
app.get("/user/collections", verifyToken, async (req, res) => {
    try {
        await connectToDatabase();
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

app.post("/renameCollection", verifyToken, async (req, res) => {
    try {
        await connectToDatabase();
        console.log(req.body);
        const { id, category, author } = req.body;
        const collections = await Collection.findOne({ author, _id: id });

        if (!collections) {
            // create a new collection
            const newCollection = new Collection({
                category,
                slug: slugify(author + "/" + category),
                author,
                items: []
            });
            await newCollection.save();
            res.status(201).json(newCollection);
        } else {
            collections.category = category;
            collections.slug = slugify(author + "/" + category);
            await collections.save();
            res.status(200).json(collections);
        }

    } catch (error) {
        console.error("Error fetching collections:", error);
        res.status(500).json({ message: "Error fetching collections" });
    }
});

app.post("/deleteCollection", verifyToken, async (req, res) => {
    try {
        await connectToDatabase();
        const { id, author } = req.body;
        const collection = await Collection.findOne({ author, _id: id });

        if (!collection) {
            return res.status(404).json({ message: "Collection not found" });
        }

        await collection.remove();
        res.status(200).json({ message: "Collection deleted successfully" });
    } catch (error) {
        console.error("Error fetching collections:", error);
        res.status(500).json({ message: "Error fetching collections" });
    }
});

// Backend route to get a single collection's data
app.get("/collections", async (req, res) => {
    try {
        await connectToDatabase();
        const collections = await Collection.find();
        res.status(200).json(collections);
    } catch (error) {
        console.error("Error fetching collections:", error);
        res.status(500).json({ message: "Error fetching collections" });
    }
});

app.post("/update", verifyToken, async (req, res) => {
    try {
        await connectToDatabase();
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
        collections.slug = slugify(collections.author + "/" + collections.category);
        collections.items = updatedItems;
        await collections.save();
        res.status(200).json(collections);
    } catch (error) {
        console.error("Error fetching collections:", error);
        res.status(500).json({ message: "Error fetching collections" });
    }
});

app.post("/edit", verifyToken, async (req, res) => {
    try {
        await connectToDatabase();
        console.log("Editing item...");
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
        await connectToDatabase();
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

app.get("/collections/:author", async (req, res) => {
    try {
        await connectToDatabase();
        const author = req.params.author;
        const collections = await Collection.find({ author: author });

        if (!collections || collections.length === 0) {
            return res.status(404).json({ message: "No collections found" });
        }

        res.status(200).json(collections);
    } catch (error) {
        console.error("Error fetching collections:", error);
        res.status(500).json({ message: "Error fetching collections" });
    }
});

app.get("/collectionId/:author/:collectionName", async (req, res) => {
    try {
        await connectToDatabase();

        const author = req.params.author;
        const collectionName = req.params.collectionName;

        const slug = slugify(author + "/" + collectionName);


        console.log("finding collection with slug:", slug);
        const collection = await Collection.findOne({ slug: slug });

        if (!collection) {
            return res.status(404).json({ message: "Collection not found" });
        }

        res.status(200).json(collection);
    } catch (error) {
        console.error("Error fetching collection:", error);
        res.status(500).json({ message: "Error fetching collection" });
    }
});

app.get("/collection/:id", async (req, res) => {
    console.log("Fetching collection with ID:", req.params.id);
    try {
        await connectToDatabase();
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
    try {
        const { id } = req.params;

        // If you're using the image filename or path as the ID, you can directly use it
        const filePath = `uploads/${id}`;  // Assuming images are in the 'uploads' folder in Supabase bucket

        // Retrieve the file from Supabase Storage
        const { data, error } = await supabase
            .storage
            .from('uploads')  // 'uploads' is your Supabase bucket name
            .download(filePath);

        if (error) {
            console.error("Error fetching image from Supabase:", error);
            return res.status(404).json({ error: "Image not found" });
        }

        // Set the correct MIME type (assuming you're serving image/jpeg)
        res.setHeader('Content-Type', 'image/jpeg');

        // Pipe the file stream to the response
        data.pipe(res);
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