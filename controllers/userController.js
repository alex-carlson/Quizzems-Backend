import { supabase, getSupabaseClientWithToken } from '../config/supabaseClient.js';
import slugify from 'slugify';
export const uploadUserAvatar = (req, res) => {
    const { userId, file, path } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    if (!file) {
        return res.status(400).json({ error: 'File is required' });
    }
}

export const getUserProfileFromUsernameSlug = async (req, res) => {
    const { usernameSlug } = req.params;

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('username_slug', usernameSlug)
            .single();
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        if (!data) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(data);
    } catch (err) {
        console.error('Error fetching user profile:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getUserSearchResults = async (req, res) => {
    const { query } = req.params;

    try {
        // Use ilike for fuzzy search on username, email, and bio
        const { data, error } = await supabase
            .from('profiles')
            .select('username, email, username_slug, id')
            .or(`username.ilike.%${query}%,email.ilike.%${query}%`);

        if (error) {
            return res.status(500).json({ error: error.message });
        }
        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'No users found' });
        }

        // Remove email from each user object and limit to 3 results
        const sanitizedData = data.slice(0, 3).map(user => {
            const { email, ...rest } = user;
            return rest;
        });
        res.json(sanitizedData);
    } catch (err) {
        console.error('Error fetching users from query:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

export const getUserProfile = async (req, res) => {
    const { uid } = req.params;
    try {
        // Try matching by `id` (uuid)
        let { data, error } = await supabase
            .from('profiles')
            .select('username, bio, email, quizzes_completed, public_id, username_slug')
            .eq('id', uid)
            .single();

        // if this fails, try matching uid with public_id (int8)
        if (error) {
            // convert uid to int
            const publicId = parseInt(uid, 10);
            ({ data, error } = await supabase
                .from('profiles')
                .select('username, bio, email, quizzes_completed, public_id, username_slug')
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
    const { userId, email, username } = req.body;

    if (!userId || !email) {
        return res.status(400).json({ error: 'User ID and email are required' });
    }

    try {
        const profileData = { id: userId, email };

        // If username is provided, add it with slug
        if (username) {
            const usernameSlug = slugify(username, {
                lower: true,
                strict: true,
                trim: true
            });

            // Check if username already exists
            const { data: existingUserByUsername, error: checkUsernameError } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', username)
                .single();

            if (checkUsernameError && checkUsernameError.code !== 'PGRST116') {
                return res.status(500).json({ error: checkUsernameError.message });
            }

            if (existingUserByUsername) {
                return res.status(400).json({ error: 'Username already exists' });
            }

            // Check if username slug already exists
            const { data: existingUserBySlug, error: checkSlugError } = await supabase
                .from('profiles')
                .select('id')
                .eq('username_slug', usernameSlug)
                .single();

            if (checkSlugError && checkSlugError.code !== 'PGRST116') {
                return res.status(500).json({ error: checkSlugError.message });
            }

            if (existingUserBySlug) {
                return res.status(400).json({ error: 'Username slug already exists, please choose a different username' });
            }

            profileData.username = username;
            profileData.username_slug = usernameSlug;
        }

        const { data, error } = await supabase
            .from('profiles')
            .insert([profileData])
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

    if (!userId || !username) {
        return res.status(400).json({ error: 'User ID and username are required' });
    }

    try {
        // Create slugified version of username
        const usernameSlug = slugify(username, {
            lower: true,
            strict: true,
            trim: true
        });

        // Check if username already exists for a different user
        const { data: existingUserByUsername, error: checkUsernameError } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username)
            .neq('id', userId)
            .single();

        if (checkUsernameError && checkUsernameError.code !== 'PGRST116') {
            // PGRST116 means no rows found, which is what we want
            return res.status(500).json({ error: checkUsernameError.message });
        }

        if (existingUserByUsername) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Check if username slug already exists for a different user
        const { data: existingUserBySlug, error: checkSlugError } = await supabase
            .from('profiles')
            .select('id')
            .eq('username_slug', usernameSlug)
            .neq('id', userId)
            .single();

        if (checkSlugError && checkSlugError.code !== 'PGRST116') {
            return res.status(500).json({ error: checkSlugError.message });
        }

        if (existingUserBySlug) {
            return res.status(400).json({ error: 'Username slug already exists, please choose a different username' });
        }

        const { data, error } = await supabase
            .from('profiles')
            .update({ username, username_slug: usernameSlug })
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
        const { data, error } = await supabase.from('profiles').select('username, bio, id, public_id, quizzes_completed, username_slug');

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
            : [];

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

export const getCollaborators = async (req, res) => {
    const quiz_id = req.query.quiz_id || req.params.quiz_id;

    if (!quiz_id) {
        return res.status(400).json({ error: 'Quiz ID is required' });
    }

    try {
        // 1. Get the collection collaborators array
        const { data: collection, error: fetchError } = await supabase
            .from('collections')
            .select('collaborators')
            .eq('id', quiz_id)
            .single();

        if (fetchError) {
            console.error('Supabase error fetching collection:', fetchError);
            return res.status(500).json({ error: fetchError.message });
        }

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        const collaboratorIds = Array.isArray(collection.collaborators)
            ? collection.collaborators
            : [];

        if (collaboratorIds.length === 0) {
            return res.json({ success: true, data: [] });
        }

        // 2. Fetch collaborator profiles based on public_id
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, username, username_slug, public_id')
            .in('public_id', collaboratorIds);

        if (profileError) {
            console.error('Supabase error fetching profiles:', profileError);
            return res.status(500).json({ error: profileError.message });
        }

        res.json({ success: true, data: profiles || [] });
    } catch (err) {
        console.error('Error getting collaborators:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const addCollaborator = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const supabase = getSupabaseClientWithToken(token);

    const { quiz_id, collaborator_id } = req.body;

    if (!quiz_id || !collaborator_id) {
        return res.status(400).json({ error: 'Quiz ID and Collaborator ID are required' });
    }

    try {
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('public_id')
            .eq('id', collaborator_id)
            .single();

        if (profileError) {
            return res.status(500).json({ error: profileError.message });
        }
        if (!profile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const publicId = profile.public_id;

        const { data: collection, error: fetchError } = await supabase
            .from('collections')
            .select('id, collaborators')
            .eq('id', quiz_id)
            .single();

        if (fetchError) {
            return res.status(500).json({ error: fetchError.message });
        }
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        let collaborators = collection.collaborators || [];
        if (!Array.isArray(collaborators)) {
            collaborators = [];
        }

        if (!collaborators.includes(publicId)) {
            collaborators.push(publicId);
        }

        const { data, error: updateError } = await supabase
            .from('collections')
            .update({ collaborators })
            .eq('id', quiz_id)
            .select()
            .single();

        if (updateError) {
            return res.status(500).json({ error: updateError.message });
        }

        res.json({
            success: true,
            message: 'Collaborator added successfully',
            data
        });

    } catch (err) {
        console.error('Error adding collaborator:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const removeCollaborator = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const supabase = getSupabaseClientWithToken(token);

    const { quiz_id, collaborator_id } = req.body;

    if (!quiz_id || !collaborator_id) {
        return res.status(400).json({ error: 'Quiz ID and Collaborator ID are required' });
    }

    try {
        // 1. Get the collaborator's public_id from profiles table
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('public_id')
            .eq('id', collaborator_id)
            .single();

        if (profileError) {
            console.error('Error fetching profile:', profileError);
            return res.status(500).json({ error: profileError.message });
        }

        if (!profile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const publicId = profile.public_id;

        // 2. Get current collaborators
        const { data: collection, error: fetchError } = await supabase
            .from('collections')
            .select('collaborators')
            .eq('id', quiz_id)
            .single();

        if (fetchError) {
            return res.status(500).json({ error: fetchError.message });
        }

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        let collaborators = collection.collaborators || [];
        if (!Array.isArray(collaborators)) {
            collaborators = [];
        }

        // 3. Remove the collaborator by public_id
        const updatedCollaborators = collaborators.filter(
            id => id !== publicId
        );

        const { data, error: updateError } = await supabase
            .from('collections')
            .update({ collaborators: updatedCollaborators })
            .eq('id', quiz_id)
            .select()
            .single();

        if (updateError) {
            return res.status(500).json({ error: updateError.message });
        }

        res.json({
            success: true,
            message: 'Collaborator removed successfully',
            data
        });

    } catch (err) {
        console.error('Error removing collaborator:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const deleteQuizScore = async (req, res) => {
    const { user_id, quiz_id } = req.body;
    if (!user_id || !quiz_id) {
        return res.status(400).json({ error: 'User ID and Quiz ID are required' });
    }

    try {
        // Fetch the user's quizzes_completed field
        const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('quizzes_completed')
            .eq('id', user_id)
            .single();

        if (fetchError) {
            return res.status(500).json({ error: fetchError.message });
        }

        let quizzes_completed = profile?.quizzes_completed || [];
        if (!Array.isArray(quizzes_completed)) {
            quizzes_completed = [];
        }

        // Remove the quiz with the matching quiz_id
        const updatedQuizzes = quizzes_completed.filter(q => q.quiz_id !== quiz_id);

        // Update the profile with the new quizzes_completed array
        const { data, error } = await supabase
            .from('profiles')
            .update({ quizzes_completed: updatedQuizzes })
            .eq('id', user_id);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({ message: 'Quiz score deleted successfully', data });
    } catch (err) {
        console.error('Error deleting quiz score:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}