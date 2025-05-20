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
    try {
        
        console.log("Getting user profile: " + uid);
        const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
        console.log("Data: " + data);
        console.log("Error: " + error);
        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};