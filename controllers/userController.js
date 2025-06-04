import { supabase } from '../config/supabaseClient.js';
export const uploadUserAvatar = (req, res) => {
    const { userId, file, path } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    if (!file) {
        return res.status(400).json({ error: 'File is required' });
    }
}

export const getUserProfile = async (req, res) => {
    const { uid } = req.params;
    console.log("Fetching user profile for UID:", uid);
    try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


export const createUserProfile = async (req, res) => {
    const { userId, email, } = req.body;

    if (!userId || !email) {
        return res.status(400).json({ error: 'User ID and email are required' });
    }

    try {
        const { data, error } = await supabase
            .from('profiles')
            .insert([{ id: userId, email }])
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
}