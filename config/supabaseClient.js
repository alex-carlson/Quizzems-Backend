// supabase.js or supabaseClient.js
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Optional: singleton client (for public, non-authenticated actions)
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// ✅ Factory for authenticated client
export const getSupabaseClientWithToken = (token) =>
  createClient(supabaseUrl, supabaseServiceRoleKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
