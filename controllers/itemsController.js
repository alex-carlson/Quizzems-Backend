import supabase from "../config/supabaseClient.js";

export const AddItemToCollection = async (req, res) => {
    try {
        const { category, author, item } = req.body;

        if (!category || !author || !item) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        if (req.uploadedImageUrl) {
            item.image = req.uploadedImageUrl;
        }

        const myItem = {
            image: item.image || null,
            answer: item.name || null
        };

        // Check if `items` column is NULL and initialize it if needed
        const { data: collection, error: fetchError } = await supabase
            .from("collections")
            .select("items")
            .eq("category", category)
            .eq("author", author)
            .single();

        if (fetchError) {
            console.error("Error fetching collection:", fetchError);
            return res.status(500).json({ error: "Failed to fetch collection", details: fetchError });
        }

        const updatedItems = collection.items ? [...collection.items, myItem] : [myItem];

        const { data, error } = await supabase
            .from("collections")
            .update({ items: updatedItems })
            .eq("category", category)
            .eq("author", author)
            .select();

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
        const { category, itemAnswer } = req.body;

        if (!category || !itemAnswer) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const { data: collection, error: fetchError } = await supabase
            .from("collections")
            .select("items")
            .eq("category", category)
            .single();

        if (fetchError) {
            console.error("Error fetching collection:", fetchError);
            return res.status(500).json({ error: "Failed to fetch collection", details: fetchError });
        }

        const updatedItems = collection.items.filter((i) => i.answer !== itemAnswer);

        const { data, error } = await supabase
            .from("collections")
            .update({ items: updatedItems })
            .eq("category", category)
            .select();

        if (error) {
            console.error("Error updating collection:", error);
            return res.status(500).json({ error: "Failed to update collection", details: error });
        }

        // wait for promise to resolve and then return data
        res.status(200).json(data);
    } catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
};