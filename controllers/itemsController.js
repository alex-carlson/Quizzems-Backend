import { getSupabaseClientWithToken, supabase } from "../config/supabaseClient.js";

// Helper: Extract token from request
const getToken = (req) => req.headers.authorization?.split(" ")[1];

// Helper: Fetch collection by category and author_id (if provided)
const fetchCollection = async (token, category, author_id = null) => {
    let query = getSupabaseClientWithToken(token)
        .from("collections")
        .select("items")
        .eq("category", category);
    if (author_id !== null && author_id !== undefined) {
        query = query.eq("author_public_id", author_id);
    }
    return await query.single();
};

// Helper: Update collection items by category and author_id (if provided)
const updateCollectionItems = async (token, category, updatedItems, author_id = null) => {
    let query = getSupabaseClientWithToken(token)
        .from("collections")
        .update({ items: updatedItems })
        .eq("category", category);
    if (author_id !== null && author_id !== undefined) {
        query = query.eq("author_public_id", author_id);
    }
    return await query.select();
};

// add thumbnail to collection
export const AddThumbnailToCollection = async (req, res) => {
    try {

        const token = getToken(req);
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }

        // return positively if image is uploaded
        if (!req.uploadedImageUrl) {
            return res.status(400).json({ error: "No image uploaded" });
        }

        return res.status(200).json({ message: "Image uploaded successfully", imageUrl: req.uploadedImageUrl });

    } catch (err) {
        handleError(res, err);
    }
};

export const AddItemToCollection = async (req, res) => {
    try {
        const { category, author, uuid, answer, author_id, author_uuid } = req.body;
        if (!category || !author || !req.uploadedImageUrl) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const token = getToken(req);
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }
        const myItem = {
            id: uuid || null,
            image: req.uploadedImageUrl || null,
            answer: answer || null
        };
        const { data: collection, error: fetchError } = await fetchCollection(token, category, author_id);
        if (fetchError) {
            console.error("Error fetching collection:", fetchError);
            return res.status(500).json({ error: "Failed to fetch collection", details: fetchError });
        }
        let updatedItems;
        if (collection.items && Array.isArray(collection.items)) {
            const existingIndex = collection.items.findIndex(item => item.id === myItem.id);
            if (existingIndex !== -1) {
                // Update existing item
                updatedItems = collection.items.map(item =>
                    item.id === myItem.id ? { ...item, ...myItem } : item
                );
            } else {
                // Append new item
                updatedItems = [...collection.items, myItem];
            }
        } else {
            updatedItems = [myItem];
        }
        const { data, error } = await updateCollectionItems(token, category, updatedItems, author_id);
        if (error) {
            console.error("Error updating collection:", error);
            return res.status(500).json({ error: "Failed to update collection", details: error });
        }
        res.status(201).json(data);
    } catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
};

export const AddAudioToCollection = async (req, res) => {
    try {
        const { category, author, uuid, answer, author_id, url } = req.body;
        console.log(req.body);
        if (!category || !author || !url) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const token = getToken(req);
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }
        const myItem = {
            id: uuid || null,
            audio: url || null,
            answer: answer || null
        };
        const { data: collection, error: fetchError } = await fetchCollection(token, category, author_id);
        if (fetchError) {
            console.error("Error fetching collection:", fetchError);
            return res.status(500).json({ error: "Failed to fetch collection", details: fetchError });
        }
        const updatedItems = collection.items ? [...collection.items, myItem] : [myItem];
        const { data, error } = await updateCollectionItems(token, category, updatedItems, author_id);
        if (error) {
            console.error("Error updating collection:", error);
            return res.status(500).json({ error: "Failed to update collection", details: error });
        }
        res.status(201).json(data);
    } catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
};

export const AddQuestionToCollection = async (req, res) => {
    try {
        const { category, author, uuid, question, answer, author_id } = req.body;
        if (!category || !author || !question || !answer) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const token = getToken(req);
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }
        const myItem = {
            id: uuid || null,
            question: question || null,
            answer: answer || null
        };
        const { data: collection, error: fetchError } = await fetchCollection(token, category, author_id);
        if (fetchError) {
            console.error("Error fetching collection:", fetchError);
            return res.status(500).json({ error: "Failed to fetch collection", details: fetchError });
        }
        const updatedItems = collection.items ? [...collection.items, myItem] : [myItem];
        const { data, error } = await updateCollectionItems(token, category, updatedItems, author_id);
        if (error) {
            console.error("Error updating collection:", error);
            return res.status(500).json({ error: "Failed to update collection", details: error });
        }
        res.status(201).json(data);
    } catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
};

export const RemoveItemFromCollection = async (req, res) => {
    try {
        const { category, itemId } = req.body;
        const token = getToken(req);
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }
        if (!category || !itemId) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const { data: collection, error: fetchError } = await fetchCollection(token, category);
        if (fetchError) {
            console.error("Error fetching collection:", fetchError);
            return res.status(500).json({ error: "Failed to fetch collection", details: fetchError });
        }
        const updatedItems = collection.items.filter((i) => i.id !== itemId);
        // also delete the image from storage
        const { error: deleteError } = await getSupabaseClientWithToken(token).storage
            .from("uploads")
            .remove([`uploads/${category}/${itemId}`]);
        if (deleteError) {
            console.error("Error deleting image from storage:", deleteError);
            return res.status(500).json({ error: "Failed to delete image from storage", details: deleteError });
        }
        const { data, error } = await updateCollectionItems(token, category, updatedItems);
        if (error) {
            console.error("Error updating collection:", error);
            return res.status(500).json({ error: "Failed to update collection", details: error });
        }
        res.status(200).json({ items: updatedItems });
    } catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
};

export const EditItemInCollection = async (req, res) => {
    try {
        const { collection, id, author_id, ...updateFields } = req.body;
        const token = getToken(req);
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }
        if (!collection || !id) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const { data, error } = await fetchCollection(token, collection, author_id);
        if (error) {
            console.error("Error fetching collection:", error);
            return res.status(500).json({ error: "Failed to fetch collection", details: error });
        }
        let items = data.items;
        items = items.map(item =>
            item.id === id ? { ...item, ...updateFields } : item
        );

        const { error: updateError } = await updateCollectionItems(token, collection, items, author_id);
        if (updateError) {
            console.error("Error updating collection:", updateError);
            return res.status(500).json({ error: "Failed to update collection", details: updateError });
        } else {
            res.status(200).json({ message: "Item updated successfully" });
        }
    } catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
};

export const ReorderItemInCollection = async (req, res) => {
    try {
        const { category, items, author_id } = req.body;
        console.log(items);
        const token = getToken(req);
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }
        if (!category || !items) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const { data, error } = await updateCollectionItems(token, category, items, author_id);
        if (error) {
            console.error("Error updating collection:", error);
            return res.status(500).json({ error: "Failed to update collection", details: error });
        }
        res.status(200).json(data);
    } catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
};