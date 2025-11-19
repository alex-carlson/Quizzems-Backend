import { createClient } from '@supabase/supabase-js';

export const resolvers = {
    Query: {
        getUser: async () => {
            const supabase = createClient('your-supabase-url', 'your-supabase-anon-key');

            const { data, error } = await supabase
                .from('profiles')
                .select('public_id, username, username_slug')
                .single();

            if (error) {
                throw new Error(error.message);
            }

            return data;
        }
    }
}