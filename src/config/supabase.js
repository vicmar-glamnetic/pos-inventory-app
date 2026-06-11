import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase project URL and anon key
// Get them from: https://supabase.com/dashboard → your project → Settings → API
export const SUPABASE_URL = 'https://oxbyhzibbphzqhbtndnf.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94YnloemliYnBoenFoYnRuZG5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDM2MzIsImV4cCI6MjA5NjcxOTYzMn0.cBKdtzUS2SuxVgAqKgsFpQUqW8X_FuSJ5F5bur_3wzU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export const isSupabaseConfigured =
  SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
