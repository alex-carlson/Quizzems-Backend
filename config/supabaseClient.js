// supabase.js or supabaseClient.js
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_PUBLIC_ANON_KEY;

// Optional: singleton client (for public, non-authenticated actions)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ✅ Factory for authenticated client
export const getSupabaseClientWithToken = (token) =>
  createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
