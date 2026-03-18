import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const envMode = import.meta.env.MODE as string | undefined;
const envIsVitest = import.meta.env.VITEST as boolean | undefined;
const isTestEnv = envMode === "test" || envIsVitest === true;
const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envSupabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const SUPABASE_URL =
  envSupabaseUrl ?? (isTestEnv ? "http://127.0.0.1:54321" : undefined);
const SUPABASE_PUBLISHABLE_KEY =
  envSupabasePublishableKey ?? (isTestEnv ? "test-publishable-key" : undefined);

// Fail fast at startup if required env vars are missing
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "[car-finder-pro] Missing required environment variables: " +
      [
        !SUPABASE_URL && "VITE_SUPABASE_URL",
        !SUPABASE_PUBLISHABLE_KEY && "VITE_SUPABASE_PUBLISHABLE_KEY",
      ]
        .filter(Boolean)
        .join(", ") +
      "\nCopy .env.example to .env and fill in your Supabase credentials.",
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
