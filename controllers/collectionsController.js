import supabase from '../config/supabaseClient.js';

export const getAllCollections = async (req, res) => {
    try {
        const { data, error } = await supabase.from('collections').select('*');

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getUserCollection = async (req, res) => {
    try {
        const { username, collection } = req.params;
        console.log(username, collection);
        const { data, error } = await supabase.from('collections').select('*').eq('category', collection).eq('author', username);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getAllUserCollections = async (req, res) => {
    console.log(req.params)
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