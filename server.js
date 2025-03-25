// import express from 'express';
// import cors from 'cors';
// import dotenv from 'dotenv';
// import mongoose from 'mongoose';
// import Collection from './models/Collection.js';
// import User from './models/User.js';
// import jwt from 'jsonwebtoken';
// import crypto from 'crypto';
// import { createClient } from '@supabase/supabase-js'; // Ensure you have this file to initialize your Supabase client

// dotenv.config();

// const app = express();

// app.use(cors({
//     origin: process.env.CLIENT_URL,
//     credentials: true,
//     methods: "GET, POST, PUT, DELETE",
// }));
// app.use(express.json());

// const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// const connectToDatabase = async () => {
//     if (mongoose.connection.readyState === 0) {
//         await mongoose.connect(process.env.MONGO_URI, {
//             useNewUrlParser: true,
//             useUnifiedTopology: true,
//         });
//         console.log("MongoDB connected");
//     }
// };

// const getCollection = async (author, category) => {
//     // get supabase collection by author and category
//     const { data: collection, error } = await supabase
//         .from('collections')
//         .select('*')
//         .eq('author', author)
//         .eq('category', category)
//         .single();

//     if (error) {
//         console.error("Error fetching collection from Supabase:", error);
//         return null;
//     }

//     return collection;
// };

// const getCollections = async (author) => {
//     // get supabase collections by author
//     const { data: collections, error } = await supabase
//         .from('collections')
//         .select('*')
//         .eq('author', author);

//     if (error) {
//         console.error("Error fetching collections from Supabase:", error);
//         return null;
//     }

//     return collections;
// };

// const getAllCollections = async () => {
//     // get all collections from supabase
//     const { data: collections, error } = await supabase
//         .from('collections')
//         .select('*');

//     if (error) {
//         console.error("Error fetching collections from Supabase:", error);
//         return null;
//     }

//     return collections;
// };

// // Helper function to convert base64 to buffer
// const base64ToBuffer = (base64String) => {
//     // use regex to remove header and data url part of the string
//     const base64Image = base64String.replace(/^data:image\/jpeg;base64,/, '');
//     return Buffer.from(base64Image, 'base64');
// };

// const uploadImageAndUpdateDB = async (fileBuffer, fileName, author, category) => {
//     const bucketName = "uploads";
//     const storagePath = `${author}/${category}/${fileName}.jpeg`;

//     console.log("Uploading image to Supabase Storage:", storagePath);

//     // Upload image to Supabase Storage
//     const { data: uploadData, error: uploadError } = await supabase.storage
//         .from(bucketName)
//         .upload(storagePath, fileBuffer, { upsert: true, contentType: 'image/jpeg' });

//     if (uploadError) {
//         console.error("Error uploading file:", uploadError.message);
//         throw new Error("Failed to upload image");
//     }

//     // Generate the public URL for the uploaded image
//     const imageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucketName}/${storagePath}`;
//     const dateString = new Date().toISOString(); // Get the current date in ISO format

//     // Update Supabase database table with image reference
//     const { data, error } = await supabase
//         .from("files") // Change this to your table
//         .insert([{ url: imageUrl, created_at: dateString, size: fileBuffer.length }])
//         .select("*"); // Select all fields to get the inserted data back

//     if (error) {
//         console.error("Error updating database:", error.message);
//         throw new Error("Failed to update database");
//     }

//     return data;
// };


// const processItem = async (category, author, item) => {
//     const buffer = await base64ToBuffer(item.file);
//     const filename = crypto.randomUUID();
//     console.log("Processing item:", filename, category, author);
//     const d = await uploadImageAndUpdateDB(buffer, filename, author, category);
//     return d;
// };

// const verifyToken = (req, res, next) => {
//     const token = req.header('Authorization')?.replace('Bearer ', '');

//     if (!token) {
//         return res.status(403).json({ message: 'Access Denied: No token provided' });
//     }

//     try {
//         const decoded = jwt.verify(token, process.env.JWT_SECRET);
//         req.user = decoded;  // Attach user information to the request
//         next();  // Proceed to the next middleware or route handler
//     } catch (error) {
//         return res.status(401).json({ message: 'Invalid or expired token' });
//     }
// };

// app.post("/upload", verifyToken, async (req, res) => {
//     try {
//         // parse the form data to get Category, Author and Item.
//         const { category, author, item } = req.body;

//         if (!category || !author || item === undefined) {
//             return res.status(400).send("Invalid input data");
//         }

//         processItem(category, author, item).then(async (item) => {
//             console.log("Success, returning item: ", item);
//             res.status(200).json(item);
//         }).catch((error) => {
//             console.error("Error processing item:", error);
//             res.status(500).send("Error processing item");
//         });

//     } catch (error) {
//         console.error("Error processing collection:", error);
//         res.status(500).send("Error processing collection");
//     }
// });

// app.put("/changeUsername", verifyToken, async (req, res) => {
//     console.log("Changing username...");
//     try {
//         await connectToDatabase();
//         const { username, email } = req.body;
//         const user = await User.findOne({ email });

//         if (!user) {
//             return res.status(404).json({ message: "User not found" });
//         }

//         // find all collections by user and update author
//         const collections = await Collection.find({ author: user.username });
//         collections.forEach(async collection => {
//             collection.author = username;
//             await collection.save();
//         });

//         user.username = username;
//         await user.save();
//         res.status(200).json(user);
//     } catch (error) {
//         console.error("Error fetching user:", error);
//         res.status(500).json({ message: "Error fetching user" });
//     }
// });

// // Route to get user's collections
// app.get("/user/collections", verifyToken, async (req, res) => {
//     try {
//         const collections = await getCollections(req.user.username);

//         if (!collections || collections.length === 0) {
//             return res.status(404).json({ message: "No collections found" });
//         }

//         res.status(200).json(collections);
//     } catch (error) {
//         console.error("Error fetching collections:", error);
//         res.status(500).json({ message: "Error fetching collections", error });
//     }
// });

// // create a new collection
// app.post("/createCollection", verifyToken, async (req, res) => {
//     try {
//         const { author, category } = req.body;

//         if (!category || !author) {
//             return res.status(400).send("Invalid input data");
//         }

//         // add new collection to supabase
//         const { data, error } = await supabase
//             .from('collections')
//             .insert([{ author, category, items: [], created_at: new Date().toISOString() }]);

//         if (error) {
//             console.error("Error creating collection:", error);
//             return res.status(500).json({ message: "Error creating collection" });
//         }
//     }
//     catch (error) {
//         console.error("Error creating collection:", error);
//         res.status(500).json({ message: "Error creating collection" });
//     }
// });

// app.post("/renameCollection", verifyToken, async (req, res) => {
//     try {
        
//         // upload image to supabase storage
//         const { author, category, newCategory } = req.body;

//         if (!category || !author) {
//             return res.status(400).send("Invalid input data");
//         }

//         const collection = await getCollection(author, category);

//         // if collection is null, create a new one
//         if(!collection) {
//             const { data, error } = await supabase
//                 .from('collections')
//                 .insert([{ author, category: newCategory, created_at: new Date().toISOString() }])
//                 .single();
//         }

//         if (error) {
//             console.error("Error fetching collection from Supabase:", error);
//             return res.status(404).json({ error: "Collection not found" });
//         } else {
//             collection.category = newCategory;
//             // push changes to server
//             const { data, error } = await supabase
//                 .from('collections')
//                 .update({ category: newCategory })
//                 .eq('author', author)
//                 .eq('category', category);
//         }

//         // if collection is found, update the category, else add a new one to collections
//         if(collection) {
//             const { data, error } = await supabase
//                 .from('collections')
//                 .update({ category: newCategory })
//                 .eq('author', author)
//                 .eq('category', category);
//         } else {
//             const { data, error } = await supabase
//                 .from('collections')
//                 .insert([{ author, category: newCategory, created_at: new Date().toISOString() }])
//                 .single();
//         }
//     } catch (error) {
//         console.error("Error fetching collections:", error);
//         res.status(500).json({ message: "Error fetching collections" });
//     }
// });

// app.post("/deleteCollection", verifyToken, async (req, res) => {
//     try {
//         const { id, author } = req.body;

//         const collection = await getCollection(author, id);

//         if (!collection) {
//             return res.status(404).json({ message: "Collection not found" });
//         }

//         await collection.remove();
//         res.status(200).json({ message: "Collection deleted successfully" });
//     } catch (error) {
//         console.error("Error fetching collections:", error);
//         res.status(500).json({ message: "Error fetching collections" });
//     }
// });

// // Backend route to get a single collection's data
// app.get("/collections", async (req, res) => {
//     try {
//         const collections = await getAllCollections();
//         res.status(200).json(collections);
//     } catch (error) {
//         console.error("Error fetching collections:", error);
//         res.status(500).json({ message: "Error fetching collections" });
//     }
// });

// app.post("/update", verifyToken, async (req, res) => {
//     try {
//         const { collection, id, answer } = req.body;
//         const collections = await getCollections(collection);
//         if (!collections) {
//             return res.status(404).json({ message: "Collection not found" });
//         }
//         const items = collections.items;
//         const updatedItems = items.map(item => {
//             if (item.id === id) {
//                 item.answer = answer;
//             }
//             return item;
//         });
//         collections.items = updatedItems;
//         await collections.save();
//         res.status(200).json(collections);
//     } catch (error) {
//         console.error("Error fetching collections:", error);
//         res.status(500).json({ message: "Error fetching collections" });
//     }
// });

// app.post("/edit", verifyToken, async (req, res) => {
//     try {
//         await connectToDatabase();
//         console.log("Editing item...");
//         const { collection, id, answer } = req.body;
//         const collections = await Collection.findOne({ category: collection });
//         if (!collections) {
//             return res.status(404).json({ message: "Collection not found" });
//         }
//         const items = collections.items;
//         const updatedItems = items.map(item => {
//             if (item.id === id) {
//                 item.answer = answer;
//             }
//             return item;
//         });
//         collections.items = updatedItems;
//         await collections.save();
//         res.status(200).json(collections);
//     } catch (error) {
//         console.error("Error fetching collections:", error);
//         res.status(500).json({ message: "Error fetching collections" });
//     }
// });

// app.post("/remove", verifyToken, async (req, res) => {
//     try {
//         const { collection, id } = req.body;
//         const collections = await Collection.findOne({ category: collection });
//         if (!collections) {
//             return res.status(404).json({ message: "Collection not found" });
//         }
//         const items = collections.items;
//         const newItems = items.filter(item => item.id !== id);
//         collections.items = newItems;
//         await collections.save();
//         res.status(200).json(collections);
//     } catch (error) {
//         console.error("Error fetching collections:", error);
//         res.status(500).json({ message: "Error fetching collections" });
//     }
// });

// app.get("/collections/:author", async (req, res) => {
//     try {
//         const author = req.params.author;

//         const collections = await getCollections(author);

//         if (error) {
//             console.error("Error fetching collection from Supabase:", error);
//             return res.status(404).json({ error: "Collection not found" });
//         }

//         res.status(200).json(collections);
//     }
//     catch (error) {
//         console.error("Error fetching collections:", error);
//         res.status(500).json({ message: "Error fetching collections" });
//     }
// });

// app.get("/collection/:author/:collectionName", async (req, res) => {
//     console.log("Fetching collection with author and name:", req.params.author, req.params.collectionName);
//     try {
//         const author = req.params.author;
//         const collectionName = req.params.collectionName;
//         const collection = await getCollection(author, collectionName);

//         if (error) {
//             console.error("Error fetching collection from Supabase:", error);
//             return res.status(404).json({ error: "Collection not found" });
//         }

//         res.status(200).json(collection);
//     } catch (error) {
//         console.error("Error fetching collection:", error);
//         res.status(500).json({ message: "Error fetching collection" });
//     }
// });

// app.get("/collection/:id", async (req, res) => {
//     try {
//         const collectionId = req.params.id;

//         console.log("Fetching collection with ID:", collectionId);

//         // get data from supabase
//         const collection = await getCollection(collectionId);

//         if (error) {
//             console.error("Error fetching collection from Supabase:", error);
//             return res.status(404).json({ error: "Collection not found" });
//         }

//         res.status(200).json(collection);
//     } catch (error) {
//         console.error("Error fetching collection:", error);
//         res.status(500).json({ message: "Error fetching collection" });
//     }
// });

// app.get("/image/:id", async (req, res) => {
//     try {
//         const { id } = req.params;

//         console.log("fetching image with ID:", id);

//         // If you're using the image filename or path as the ID, you can directly use it
//         const filePath = `uploads/${id}`;  // Assuming images are in the 'uploads' folder in Supabase bucket

//         // Retrieve the file from Supabase Storage
//         const { data, error } = await supabase
//             .storage
//             .from('uploads')  // 'uploads' is your Supabase bucket name
//             .download(filePath);

//         if (error) {
//             console.error("Error fetching image from Supabase:", error);
//             return res.status(404).json({ error: "Image not found" });
//         }

//         // Set the correct MIME type (assuming you're serving image/jpeg)
//         res.setHeader('Content-Type', 'image/jpeg');

//         // Pipe the file stream to the response
//         data.pipe(res);
//     } catch (error) {
//         console.error("Error fetching image:", error);
//         res.status(500).json({ error: "Internal server error" });
//     }
// });

import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});