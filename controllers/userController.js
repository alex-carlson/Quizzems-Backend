import { supabase, getSupabaseClientWithToken } from '../config/supabaseClient.js';
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
        // Try matching by `id` (uuid)
        let { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', uid)
            .single();

        // if this fails, try matching uid with public_id (int8)
        if (error) {
            // convert uid to int
            const publicId = parseInt(uid, 10);
            ({ data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('public_id', publicId)
                .single());
        }

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

export const changeUsername = async (req, res) => {
    const { userId, username } = req.body;

    console.log("Changing username for userId:", userId, "to username:", username);

    if (!userId || !username) {
        return res.status(400).json({ error: 'User ID and username are required' });
    }

    try {
        // Check if username already exists for a different user
        const { data: existingUser, error: checkError } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username)
            .neq('id', userId)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            // PGRST116 means no rows found, which is what we want
            return res.status(500).json({ error: checkError.message });
        }

        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const { data, error } = await supabase
            .from('profiles')
            .update({ username })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // also loop through collections and update the author to username
        const { error: collectionError } = await supabase
            .from('collections')
            .update({ author: username })
            .eq('author_uuid', userId);

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

export const getUsernames = async (req, res) => {
    try {
        const { data, error } = await supabase.from('profiles').select('username, bio, id, public_id, quizzes_completed');

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const completeQuiz = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const { user_id, quiz_id, percentage } = req.body;

    if (!user_id || !quiz_id) {
        return res.status(400).json({ error: 'User ID and quiz ID are required' });
    }

    try {
        // Fetch current profile with quizzes_completed
        const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('quizzes_completed')
            .eq('id', user_id)
            .single();

        if (fetchError) {
            return res.status(500).json({ error: fetchError.message });
        }

        // Ensure quizzes_completed is an array
        const currentQuizzes = Array.isArray(profile.quizzes_completed)
            ? profile.quizzes_completed
            : profile.quizzes_completed === null
                ? []
                : [];

        // Find if quiz already exists
        const existingIndex = currentQuizzes.findIndex(q => q.quiz_id === quiz_id);

        let updatedQuizzes;
        if (existingIndex !== -1) {
            // Only update if new percentage is higher
            if (percentage > currentQuizzes[existingIndex].percentage) {
                const updatedQuiz = { ...currentQuizzes[existingIndex], percentage };
                updatedQuizzes = [
                    ...currentQuizzes.slice(0, existingIndex),
                    updatedQuiz,
                    ...currentQuizzes.slice(existingIndex + 1)
                ];
            } else {
                updatedQuizzes = currentQuizzes;
            }
        } else {
            updatedQuizzes = [...currentQuizzes, { quiz_id, percentage }];
        }


        // Update the user's profile
        const { data, error: updateError } = await getSupabaseClientWithToken(token)
            .from('profiles')
            .update({ quizzes_completed: updatedQuizzes })
            .eq('id', user_id)
            .select()
            .single();

        if (updateError) {
            console.error('Update error:', updateError);
            return res.status(500).json({ error: updateError.message });
        }

        res.json(data);
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
