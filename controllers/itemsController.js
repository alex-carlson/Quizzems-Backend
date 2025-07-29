import { getSupabaseClientWithToken, supabase } from "../config/supabaseClient.js";

// Helper: Extract token from request
const getToken = (req) => req.headers.authorization?.split(" ")[1];

// Helper: Fetch collection by category and author_id (if provided)
const fetchCollection = async (token, category, author_id = null) => {
    let query = getSupabaseClientWithToken(token)
        .from("collections_v2")
        .select("questions")
        .eq("category", category);
    if (author_id !== null && author_id !== undefined) {
        query = query.eq("author_public_id", author_id);
    }
    return await query.single();
};

export const getItemById = async (req, res) => {
    const itemId = req.params.id;
    try {
        const { data, error } = await supabase
            .from("questions")
            .select("*")
            .eq("id", itemId)
            .single();

        if (error) {
            console.error("Error fetching item by ID:", error);
            return res.status(404).json({ error: "Item not found" });
        }

        return res.status(200).json(data);
    } catch (err) {
        console.error("Unexpected error in getItemById:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

export const getItemsByCollectionId = async (req, res) => {
    const collectionId = req.params.collectionId;
    try {
        const { data, error } = await supabase
            .from("questions")
            .select("*")
            .eq("collection_id", collectionId);

        if (error) {
            console.error("Error fetching items by collection ID:", error);
            return res.status(404).json({ error: "Items not found" });
        }

        return res.status(200).json(data);
    } catch (err) {
        console.error("Unexpected error in getItemsByCollectionId:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

// update item
export const updateItem = async (req, res) => {
    const itemId = req.body.id;
    console.log("Updating item by ID:", itemId);

    // Only update columns that exist in the 'questions' table
    // Define allowed columns here:
    const allowedColumns = [
        "collection_id",
        "type",
        "prompt",
        "answer",
        "extra",
        // add more fields as needed
    ];
    // Build update object with only allowed fields
    const updateFields = {};
    for (const key of allowedColumns) {
        if (req.body.hasOwnProperty(key)) {
            updateFields[key] = req.body[key];
        }
    }

    try {
        const { data, error } = await supabase
            .from("questions")
            .update(updateFields)
            .eq("id", itemId)
            .select()
            .single();

        if (error) {
            console.error("Error updating item by ID:", error);
            return res.status(404).json({ error: "Item not found or update failed" });
        }
        console.log("Item updated successfully:", data);
        return res.status(200).json(data);
    } catch (err) {
        console.error("Unexpected error in updateItem:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

export const RemoveQuestion = async (req, res) => {
    const { id } = req.body;
    console.log("Removing question with ID:", id);
    try {
        const { data, error } = await supabase
            .from("questions")
            .delete()
            .eq("id", id)
            .select()
            .single();

        if (error) {
            console.error("Error removing question:", error);
            return res.status(404).json({ error: "Question not found or deletion failed" });
        }
        console.log("Question removed successfully:", data);
        return res.status(200).json({ message: "Question removed successfully", data });
    } catch (err) {
        console.error("Unexpected error in removeQuestion:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

// Helper: Update collection items by category and author_id (if provided)
const updateCollectionItems = async (token, category, updatedItems, author_id = null) => {
    console.log("Updating collection items for category:", category, "with items:", updatedItems);
    console.log("Author ID:", author_id);
    let query = getSupabaseClientWithToken(token)
        .from("collections_v2")
        .update({ questions: updatedItems })
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

export const AddItemToQuestion = async (req, res) => {
    try {
        const { category, author, uuid, prompt, answer, author_id, collection_id, type, extra } = req.body;

        // Basic validation
        if (!category || !author || !prompt || !answer || !collection_id || !author_id) {
            console.error("Missing required fields:", { category, author, prompt, answer, collection_id, author_id });
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Auth check
        const token = getToken(req);
        if (!token) {
            console.error("No token provided in request headers");
            return res.status(401).json({ error: "No token provided" });
        }

        // Wait for uploadedImageUrl if not present but file upload is in progress
        let imageUrl = req.uploadedImageUrl;
        if (!imageUrl && req.file && typeof req.file === 'object') {
            // If using multer or similar, wait for file upload to complete
            imageUrl = await new Promise((resolve) => {
                const check = () => {
                    if (req.uploadedImageUrl) {
                        resolve(req.uploadedImageUrl);
                    } else {
                        setTimeout(check, 100);
                    }
                };
                check();
            });
        }

        const myItem = {
            id: uuid,
            collection_id: Number(collection_id), // Ensure it's int8
            type: "image", // Default type
            prompt: imageUrl || prompt || null,
            answer,
            extra: extra || null
            // created_at will be handled by Supabase default
        };

        // Insert into 'questions' table
        const { data, error } = await supabase
            .from("questions")
            .insert([myItem])
            .select()
            .single();

        if (error) {
            console.error("Error inserting question:", error);
            return res.status(500).json({ error: "Failed to insert question", details: error.message });
        }

        console.log("question added:", data);

        await AddItemToCollection(data.id, token, category, author_id);

        console.log("Item added to collection successfully!");

        return res.status(201).json({ message: "Question added successfully", question: data });
    } catch (err) {
        console.error("Unexpected error:", err);
        return res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
};


const AddItemToCollection = async (id, token, category, author_id) => {
    try {
        const { data: collection, error: fetchError } = await fetchCollection(token, category, author_id);
        if (fetchError) {
            console.error("Error fetching collection:", fetchError);
            return { error: "Failed to fetch collection", details: fetchError };
        }
        let updatedItems;
        if (collection.questions && Array.isArray(collection.questions)) {
            updatedItems = [...collection.questions, id];
        } else {
            updatedItems = [id];
        }
        const { data, error } = await updateCollectionItems(token, category, updatedItems, author_id);
        if (error) {
            console.error("Error updating collection:", error);
            return { error: "Failed to update collection", details: error };
        }
        return data;
    } catch (err) {
        console.error("Unexpected error:", err);
        return { error: "Internal Server Error", details: err.message };
    }
};

export const AddAudioToCollection = async (req, res) => {
    try {
        const { category, author, author_id, url } = req.body;
        console.log(req.body);
        if (!category || !author || !url) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const token = getToken(req);
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }

        const finalBody = {
            // get id, audio, title, answer, and thumbnail from req.body
            id: req.body.id || null,
            audio: url || null,
            title: req.body.title || null,
            answer: req.body.answer || null,
            thumbnail: req.body.thumbnail || null
        }

        const myItem = {
            ...finalBody
        };
        console.log("myItem", myItem);
        const { data: collection, error: fetchError } = await fetchCollection(token, category, author_id);
        if (fetchError) {
            console.error("Error fetching collection:", fetchError);
            return res.status(500).json({ error: "Failed to fetch collection", details: fetchError });
        }
        const updatedItems = collection.items ? [...collection.items, myItem.id] : [myItem];
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
        const updatedItems = collection.items ? [...collection.items, myItem.id] : [myItem];
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
        const { category, itemId, author_id } = req.body;
        const token = getToken(req);
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }
        if (!category || !itemId) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const { data: collection, error: fetchError } = await fetchCollection(token, category, author_id);
        if (fetchError) {
            console.error("Error fetching collection:", fetchError);
            return res.status(500).json({ error: "Failed to fetch collection", details: fetchError });
        }
        const updatedQuestions = Array.isArray(collection.questions)
            ? collection.questions.filter((id) => id !== itemId)
            : [];
        const { data, error } = await updateCollectionItems(token, category, updatedQuestions, author_id);
        if (error) {
            console.error("Error updating collection:", error);
            return res.status(500).json({ error: "Failed to update collection", details: error });
        }
        res.status(200).json({ questions: updatedQuestions });
    } catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
};

export const EditItemInCollection = async (req, res) => {
    try {
        const { id, ...updateFields } = req.body;
        const token = getToken(req);
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }
        if (!collection || !id) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // load 

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