import { getSupabaseClientWithToken, supabase } from "../config/supabaseClient.js";
import crypto from "crypto";
import { deleteFromR2 } from "../middleware/multer.js";

// Helper: Extract token from request
const getToken = (req) => req.headers.authorization?.split(" ")[1];

// Helper: Fetch collection by category and author_id (if provided)
const fetchCollection = async (token, category, author_id = null) => {
    let supabase = getSupabaseClientWithToken(token);

    let query = supabase
        .from("collections")
        .select("items,id")
        .eq("category", category);

    if (author_id !== null && author_id !== undefined) {
        // Use .or() to check either author_public_id matches OR collaborators contains author_id
        query = query.or(
            `author_public_id.eq.${author_id},collaborators.cs.{${author_id}}`
        );
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
        // Use .or() to match either author_public_id or collaborators contains author_id
        query = query.or(
            `author_public_id.eq.${author_id},collaborators.cs.{${author_id}}`
        );
    }
    return await query.select();
};

// Generic helper: Add item to collection with common fields
const addItemToCollectionHelper = async (req, token, category, author_id, itemData, shouldUpdate = false) => {
    const { data: collection, error: fetchError } = await fetchCollection(token, category, author_id);
    if (fetchError) {
        throw new Error(`Failed to fetch collection: ${fetchError.message}`);
    }

    if (!collection) {
        throw new Error("Collection not found or access denied");
    }

    // Parse JSON strings for array fields
    const parsedItemData = { ...itemData };

    // ALWAYS normalize answer to valid jsonb BEFORE DB insert
    if (parsedItemData.answer !== undefined) {
        if (Array.isArray(parsedItemData.answer)) {
            parsedItemData.answer = parsedItemData.answer;
        }
        else if (parsedItemData.answer === null || parsedItemData.answer === '') {
            parsedItemData.answer = [];
        }
        else if (typeof parsedItemData.answer === 'string') {
            try {
                // try JSON first
                const parsed = JSON.parse(parsedItemData.answer);
                parsedItemData.answer = parsed;
            } catch {
                // fallback: treat as single answer array (BEST PRACTICE)
                parsedItemData.answer = [parsedItemData.answer];
            }
        }
    }

    // Remove metadata fields that shouldn't be part of the item
    const { folder, category: categoryField, isUpdate, author_id: authorIdField, forceJpeg, collection: collectionField, author_uuid, ...itemFields } = parsedItemData;

    // Validate required fields - be more lenient for image uploads via URL
    if (!itemFields.questionType && !itemFields.answerType) {
        // If neither is provided, this might be a legacy URL upload, provide defaults
        itemFields.questionType = 'image';
        itemFields.answerType = 'text';
    } else if (!itemFields.questionType || !itemFields.answerType) {
        // If only one is provided, require both
        throw new Error("Missing required fields: questionType and answerType are required");
    }

    // Create item with common fields
    const myItem = {
        id: itemFields.id || crypto.randomUUID(),
        numRequired: itemFields.numRequired || 1,
        correctAnswerIndex: itemFields.correctAnswerIndex || 0,
        type: itemFields.type || 'default',
        questionType: itemFields.questionType,
        answerType: itemFields.answerType,
        ...itemFields, // Spread additional fields
    };

    myItem.answer = parsedItemData.answer;

    // Add uploaded image URL as src and image if it exists
    if (req.uploadedImageUrl) {
        myItem.src = req.uploadedImageUrl;
        myItem.image = req.uploadedImageUrl;
    }

    let updatedItems;
    // Safely access collection items with proper error handling
    const existingItems = (collection && collection.items && Array.isArray(collection.items)) ? collection.items : [];

    if (shouldUpdate && existingItems.length > 0) {
        const existingIndex = existingItems.findIndex(item => item.id === myItem.id);
        if (existingIndex !== -1) {
            // Update existing item
            updatedItems = existingItems.map(item =>
                item.id === myItem.id ? { ...item, ...myItem } : item
            );
        } else {
            // Append new item
            updatedItems = [...existingItems, myItem];
        }
    } else {
        // Always append new item or create first item
        updatedItems = [...existingItems, myItem];
    }

    const { data, error } = await updateCollectionItems(
        token,
        category,
        updatedItems,
        author_id
    );

    if (error) {
        throw new Error(`Failed to update collection: ${error.message}`);
    }

    try {
        await appendCardFromItem(
            token,
            collection.id,
            myItem
        );
    } catch (rpcErr) {
        console.error("Card sync failed:", rpcErr);

        throw rpcErr;
    }

    return data;
};

const appendCardFromItem = async (token, collectionId, item) => {

    const safeItem = structuredClone(item);

    console.log(safeItem);

    const { error } = await getSupabaseClientWithToken(token)
        .rpc("append_card_from_collection_item", {
            p_collection_id: collectionId,
            p_item: JSON.parse(JSON.stringify(safeItem))
        });

    if (error) {
        throw new Error(`Failed to sync card: ${error.message}`);
    }
};

export const fetchRandomItems = async (count) => {
    try {
        // Call the RPC function on Supabase
        const { data, error } = await supabase.rpc('get_random_cards', { p_count: count });

        if (error) {
            throw new Error(`Failed to fetch items: ${error.message}`);
        }

        // 'data' already contains <count> random cards
        return data;
    } catch (err) {
        throw new Error(`Unexpected error fetching random items: ${err.message}`);
    }
};

export const fetchCollectionItems = async (collectionId) => {
    try {
        const { data, error } = await supabase
            .from('cards')
            .select(`
        *,
        collection:collections (
          id,
          private,
          category
        )
      `)
            .eq('collection', collectionId)
            .eq('collection.private', false); // only public collections

        if (error) throw error;

        // Filter out any nulls just in case
        return data || [];
    } catch (err) {
        throw new Error(`Unexpected error fetching collection items: ${err.message}`);
    }
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

export const GetRandomItemsInCollection = async (req, res) => {
    try {
        const { count } = req.params;
        console.log(req.params);
        if (!count) return res.status(400).json({ error: "Missing required fields" });
        const data = await fetchRandomItems(count);
        res.status(201).json(data);
    } catch (err) {
        console.error("Unexpected Error: ", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
}

export const GetItemsFromCollection = async (req, res) => {
    try {
        const { collectionId } = req.params;
        if (!collectionId) return res.status(400).json({ error: "Missing required fields" });
        const data = await fetchCollectionItems(collectionId);
        res.status(201).json(data);
    } catch (err) {
        console.error("Unexpected Error: ", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
}

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

        // Find item
        const itemToDelete = collection.items.find(item => item.id === itemId);
        const updatedItems = collection.items.filter((i) => i.id !== itemId);

        // -------------------------------
        // 🧠 DELETE FROM CARDS TABLE
        // -------------------------------
        const supabase = getSupabaseClientWithToken(token);

        const { error: cardDeleteError } = await supabase
            .from("cards")
            .delete()
            .eq("id", itemId);

        if (cardDeleteError) {
            console.error("Error deleting card:", cardDeleteError);
            return res.status(500).json({
                error: "Failed to delete card",
                details: cardDeleteError
            });
        }

        // -------------------------------
        // 🗑️ DELETE IMAGE FROM R2
        // -------------------------------
        if (itemToDelete && (itemToDelete.src || itemToDelete.image)) {
            try {
                const imageUrl = itemToDelete.src || itemToDelete.image;
                const fileName = imageUrl.split('/').pop().split('?')[0];
                await deleteFromR2(fileName);
            } catch (deleteError) {
                console.error("Error deleting image from R2 storage:", deleteError);
            }
        }

        // -------------------------------
        // 💾 UPDATE COLLECTION
        // -------------------------------
        const { data, error } = await updateCollectionItems(token, category, updatedItems);

        if (error) {
            console.error("Error updating collection:", error);
            return res.status(500).json({ error: "Failed to update collection", details: error });
        }

        return res.status(200).json({ items: updatedItems });

    } catch (err) {
        console.error("Unexpected error:", err);
        return res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
};

export const EditItemInCollection = async (req, res) => {
    try {
        const { collection, id, author_id, existingItemId, isUpdate, folder, forceJpeg, author_uuid, ...updateFields } = req.body;
        const token = getToken(req);
        // hack for inconsistent collection name
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }
        if (!collection) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // If isUpdate flag is present, use the addItemToCollectionHelper for updating
        if (isUpdate) {
            try {
                const data = await addItemToCollectionHelper(req, token, collection, author_id, req.body, true);
                // Find the updated item from the collection
                const updatedCollection = await fetchCollection(token, collection, author_id);
                const updatedItem = updatedCollection.data?.items?.find(item => item.id === req.body.id);
                return res.status(200).json({ message: "Item updated successfully", item: updatedItem, data });
            } catch (error) {
                console.error("Error updating item:", error);
                return res.status(500).json({ error: "Failed to update item", details: error.message });
            }
        }

        // Original logic for direct item editing
        if (!existingItemId) {
            return res.status(400).json({ error: "Missing existingItemId for direct edit" });
        }

        // Validate required fields if they are being updated
        if (updateFields.hasOwnProperty('questionType') && !updateFields.questionType) {
            return res.status(400).json({ error: "questionType is required" });
        }
        if (updateFields.hasOwnProperty('answerType') && !updateFields.answerType) {
            return res.status(400).json({ error: "answerType is required" });
        }

        const { data, error } = await fetchCollection(token, collection, author_id);
        if (error) {
            console.error("Error fetching collection:", error);
            return res.status(500).json({ error: "Failed to fetch collection", details: error });
        }

        let updatedItem = null;
        let items = data.items;
        items = items.map(item => {
            if (item.id === existingItemId) {
                updatedItem = { ...item, ...updateFields };
                return updatedItem;
            }
            return item;
        });

        const { error: updateError } = await updateCollectionItems(token, collection, items, author_id);
        if (updateError) {
            console.error("Error updating collection:", updateError);
            return res.status(500).json({ error: "Failed to update collection", details: updateError });
        } else {
            res.status(200).json({ message: "Item updated successfully", item: updatedItem });
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