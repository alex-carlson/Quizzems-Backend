import { supabase, getSupabaseClientWithToken } from '../config/supabaseClient.js';

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

export const searchCollections = async (req, res) => {
    try {
        const { searchTerm } = req.query;

        // Step 1: Get matching results
        const { data: matching, error: matchError } = await supabase
            .from('collections')
            .select('*')
            .eq('private', false)
            .or(`category.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%`);

        if (matchError) {
            return res.status(500).json({ error: matchError.message });
        }

        // If 10 or more results found, return them
        if (matching.length >= 10) {
            return res.json(matching.slice(0, 10));
        }

        // Step 2: Fetch additional non-matching results to fill to 10
        const excludeIds = matching.map(item => item.id); // assume you have `id` field

        const { data: filler, error: fillerError } = await supabase
            .from('collections')
            .select('*')
            .eq('private', false)
            .not('id', 'in', `(${excludeIds.join(',')})`)
            .limit(10 - matching.length);

        if (fillerError) {
            return res.status(500).json({ error: fillerError.message });
        }

        // Combine search results with filler and send
        const combined = [...matching, ...filler];
        res.json(combined);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


export const getUserCollectionById = async (req, res) => {
    try {
        const { id } = req.params;
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const { data, error } = await getSupabaseClientWithToken(token)
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
        const { uid, collection } = req.params;
        const { data, error } = await supabase.from('collections').select('*').eq('category', collection).eq('author_id', uid).single();

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
        const { uid } = req.params;

        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }



        const { data, error } = await getSupabaseClientWithToken(token).from('collections').select('*').eq('author_id', uid);

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
        const { uid } = req.params;
        console.log("Getting all collections from " + uid);
        const { data, error } = await supabase.from('collections').select('*').eq('author_id', uid);

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

        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const { category, author_id, author } = req.body;

        // ✅ Validate required fields first
        if (!category || !author || !author_id) {
            return res.status(400).json({ error: 'Missing category, author, or author_id' });
        }

        // make sure jwt token has 3 parts
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
            return res.status(401).json({ error: 'Invalid token format' });
        }

        // ✅ Proceed with insertion
        const { data, error } = await getSupabaseClientWithToken(token)
            .from('collections')
            .insert([{
                category,
                author,
                author_id,
                items: [],
                private: true
            }])
            .select();

        if (error) {
            console.error('Insert error:', error.message);
            return res.status(500).json({ error: error.message });
        }

        res.status(201).json(data);
    } catch (err) {
        console.error('Catch error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


export const renameCollection = async (req, res) => {
    try {
        const { oldCategory, newCategory } = req.body;
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        console.log("Changing name from " + oldCategory + " to " + newCategory);

        // use supabase to find collection with oldName and change the collection name to newName
        const { data, error } = await getSupabaseClientWithToken(token).from('collections').update({ category: newCategory }).eq('category', oldCategory).select();

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
        const { collection, author_id, username } = req.body;
        console.log("delete body: " + req.body);

        // list all the params
        console.log("Deleting collection " + collection + " from " + username);
        console.log("Author ID: " + author_id);

        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const { data, error } = await getSupabaseClientWithToken(token).from('collections').delete().eq('category', collection).eq('author_id', author_id);

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
        const { category, author, author_id, visible } = req.body;
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const { data, error } = await getSupabaseClientWithToken(token)
            .from('collections')
            .update({ private: !visible })
            .eq('category', category)
            .eq('author_id', author_id)
            .select('*');

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
}