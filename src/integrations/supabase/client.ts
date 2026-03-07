import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const isTestEnv = import.meta.env.MODE === 'test' || import.meta.env.VITEST;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || (isTestEnv ? 'http://127.0.0.1:54321' : undefined);
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || (isTestEnv ? 'test-publishable-key' : undefined);

// Fail fast at startup if required env vars are missing
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    '[car-finder-pro] Missing required environment variables: ' +
    [
      !SUPABASE_URL && 'VITE_SUPABASE_URL',
      !SUPABASE_PUBLISHABLE_KEY && 'VITE_SUPABASE_PUBLISHABLE_KEY',
    ]
      .filter(Boolean)
      .join(', ') +
    '\nCopy .env.example to .env and fill in your Supabase credentials.'
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
