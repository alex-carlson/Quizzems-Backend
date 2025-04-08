import supabase from '../config/supabaseClient.js';

export const getAllCollections = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('collections')
            .select('*')
            .eq('private', false);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getLatestCollections = async (req, res) => {
    try {
        
        const max = 10;

        // get 10 collections from database, ordered by created_at desc
        const { data, error } = await supabase
            .from('collections')
            .select('*')
            .eq('private', false)
            .order('created_at', { ascending: false })
            .limit(max);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getUserCollectionById = async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('collections')
            .select('*')
            .eq("id", id)
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getUserCollection = async (req, res) => {
    try {
        const { username, collection } = req.params;
        const { data, error } = await supabase.from('collections').select('*').eq('category', collection).eq('author', username).single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getPublicUserCollection = async (req, res) => {
    try {
        const { username, collection } = req.params;
        console.log("Getting public collection " + collection + " from " + username);
        const { data, error } = await supabase.from('collections').select('*').eq('category', collection).eq('author', username).eq('private', false).single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getUserCollections = async (req, res) => {
    try {
        const { username } = req.params;
        const { data, error } = await supabase.from('collections').select('*').eq('author', username);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getAllUserCollections = async (req, res) => {
    try {
        const { username } = req.params;
        console.log("Getting all collections from " + username);
        const { data, error } = await supabase.from('collections').select('*').eq('author', username).eq('private', false);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const createNewCollection = async (req, res) => {
    try {
        const { category, username } = req.body;
        const { data, error } = await supabase.from('collections').insert([{ category, author: username, items: [], private: Boolean(true) }]).select();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // if category or username is null, return 400
        if (!category || !username) {
            return res.status(400).json({ error: 'Bad Request' });
        }

        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const renameCollection = async (req, res) => {
    try {
        const { oldCategory, newCategory } = req.body;

        console.log("Changing name from " + oldCategory + " to " + newCategory);

        // use supabase to find collection with oldName and change the collection name to newName
        const { data, error } = await supabase.from('collections').update({ category: newCategory }).eq('category', oldCategory).select();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const deleteCollection = async (req, res) => {
    try {
        const { username, collection } = req.params;
        console.log("Deleting collection " + collection + " from " + username);
        const { data, error } = await supabase.from('collections').delete().eq('category', collection).eq('author', username);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const setVisible = async (req, res) => {
    try {
        const { category, author, visible } = req.body;

        console.log("Setting visibility of " + category + " to " + visible);

        const { data, error } = await supabase
            .from('collections')
            .update({ private: !visible })
            .eq('category', category)
            .eq('author', author)
            .select('*');

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
}