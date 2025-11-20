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

// Generic helper: Add item to collection with common fields
const addItemToCollectionHelper = async (req, token, category, author_id, itemData, shouldUpdate = false) => {
    const { data: collection, error: fetchError } = await fetchCollection(token, category, author_id);
    if (fetchError) {
        throw new Error(`Failed to fetch collection: ${fetchError.message}`);
    }

    console.log("Body:", itemData);

    // Parse JSON strings for array fields
    const parsedItemData = { ...itemData };
    if (typeof parsedItemData.answers === 'string') {
        try {
            parsedItemData.answers = JSON.parse(parsedItemData.answers);
        } catch (e) {
            console.warn('Failed to parse answers as JSON:', parsedItemData.answers);
        }
    }
    if (typeof parsedItemData.answer === 'string') {
        try {
            // Check if answer looks like a JSON array
            if (parsedItemData.answer.startsWith('[') && parsedItemData.answer.endsWith(']')) {
                parsedItemData.answer = JSON.parse(parsedItemData.answer);
            }
        } catch (e) {
            console.warn('Failed to parse answer as JSON:', parsedItemData.answer);
        }
    }

    // Create item with common fields
    const myItem = {
        id: parsedItemData.id || crypto.randomUUID(),
        numRequired: parsedItemData.numRequired || 1,
        correctAnswerIndex: parsedItemData.correctAnswerIndex || 0,
        type: parsedItemData.type || 'default',
        ...parsedItemData // Spread additional fields
    };

    // Add uploaded image URL as src and image if it exists
    if (req.uploadedImageUrl) {
        myItem.src = req.uploadedImageUrl;
        myItem.image = req.uploadedImageUrl;
    }

    let updatedItems;
    if (collection.items && Array.isArray(collection.items)) {
        if (shouldUpdate) {
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
            // Always append new item
            updatedItems = [...collection.items, myItem];
        }
    } else {
        updatedItems = [myItem];
    }

    const { data, error } = await updateCollectionItems(token, category, updatedItems, author_id);
    if (error) {
        throw new Error(`Failed to update collection: ${error.message}`);
    }
    return data;
};

// add thumbnail to collection
export const AddThumbnailToCollection = async (req, res) => {
    try {

        const token = getToken(req);
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }

        const { category, author_id } = req.body;

        // select row in collections table where category and author_id match
        if (!category || !author_id || !req.uploadedImageUrl) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        supabase
            .from("collections")
            .update({ thumbnail_url: req.uploadedImageUrl })
            .eq("category", category)
            .eq("author_public_id", author_id)
            .then(({ data, error }) => {
                if (error) {
                    console.error("Error updating collection thumbnail:", error);
                    return res.status(500).json({ error: "Failed to update collection thumbnail", details: error });
                }
                console.log("Thumbnail updated successfully:", data);
                return res.status(200).json({ message: "Thumbnail updated successfully", data });
            })
            .catch((err) => {
                console.error("Unexpected error while updating thumbnail:", err);
                res.status(500).json({ error: "Internal Server Error", details: err.message });
            });
    } catch (err) {
        console.error("Unexpected error in AddThumbnailToCollection:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
};

export const AddItemToCollection = async (req, res) => {
    try {
        const { category, author, author_id } = req.body;
        if (!category || !author || !req.uploadedImageUrl) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const token = getToken(req);
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }

        const data = await addItemToCollectionHelper(req, token, category, author_id, req.body, true);
        res.status(201).json(data);
    } catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
};

export const AddAudioToCollection = async (req, res) => {
    try {
        const { category, author, author_id, url } = req.body;
        if (!category || !author || !url) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const token = getToken(req);
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }

        const data = await addItemToCollectionHelper(req, token, category, author_id, req.body);
        res.status(201).json(data);
    } catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
};

export const AddQuestionToCollection = async (req, res) => {
    try {
        const { category, author, question, answer, author_id } = req.body;
        if (!category || !author || !question || !answer) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const token = getToken(req);
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }

        const data = await addItemToCollectionHelper(req, token, category, author_id, req.body);
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