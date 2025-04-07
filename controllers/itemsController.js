import supabase from "../config/supabaseClient.js";

export const AddItemToCollection = async (req, res) => {
    try {

        console.log("Image URL in AddItemToCollection:", req.uploadedImageUrl);


        const { category, author, uuid, answer } = req.body;

        if (!category || !author || !req.uploadedImageUrl) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const myItem = {
            id: uuid || null,
            image: req.uploadedImageUrl || null,
            answer: answer || null
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
        const { category, itemId } = req.body;

        console.log("Removing item from collection:", category, itemId);

        if (!category || !itemId) {
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

        const updatedItems = collection.items.filter((i) => i.id !== itemId);

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

export const EditItemInCollection = async (req, res) => {
    try {
        const { collection, id, answer } = req.body;

        // find the entry with the matching image and update the text
        if (!collection || !id || !answer) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const { data, error } = await supabase
            .from("collections")
            .select("items")
            .eq("category", collection)
            .single();

        if (error) {
            console.error("Error updating collection:", error);
            return res.status(500).json({ error: "Failed to update collection", details: error });
        } else {
            let items = data.items;

            items = items.map(item =>
                item.id === id ? { ...item, answer } : item
            );

            const { error: updateError } = await supabase
                .from("collections")
                .update({ items })
                .eq("category", collection)

            if (updateError) {
                console.error("Error updating collection:", updateError);
                return res.status(500).json({ error: "Failed to update collection", details: updateError });
            } else {
                res.status(200).json({ message: "Item updated successfully" });
            }
        }
    }
    catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
};

// reorder item in collection

export const ReorderItemInCollection = async (req, res) => {
    try {
        console.log("Reordering items in collection:", req.body);
        const { category, itemAnswers } = req.body;

        if (!category || !itemAnswers) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // sort supabase category items array to match the order of itemAnswers
        const { data: collection, error: fetchError } = await supabase
            .from("collections")
            .select("items")
            .eq("category", category)
            .single();

        if (fetchError) {
            console.error("Error fetching collection:", fetchError);
            return res.status(500).json({ error: "Failed to fetch collection", details: fetchError });
        }

        // create a map of itemAnswers to their index
        const itemAnswersMap = {};
        itemAnswers.forEach((item, index) => {
            itemAnswersMap[item.id] = index;
        });

        // sort the collection items based on the itemAnswers order
        const updatedItems = collection.items.sort((a, b) => {
            return (itemAnswersMap[a.id] || 0) - (itemAnswersMap[b.id] || 0);
        });

        const { data, error } = await supabase
            .from("collections")
            .update({ items: updatedItems })
            .eq("category", category)
            .select();

        if (error) {
            console.error("Error updating collection:", error);
            return res.status(500).json({ error: "Failed to update collection", details: error });
        }

        res.status(200).json(data);
    } catch (err) {
        console.error("Unexpected error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
}