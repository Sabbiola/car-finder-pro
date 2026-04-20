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

// In dev mode, warn instead of crashing so the frontend renders without Supabase
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  if (envMode === "development") {
    console.warn(
      "[car-finder-pro] Supabase env vars missing — running in local/FastAPI mode without auth/DB.",
    );
  } else {
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
}

const SUPABASE_URL_SAFE = SUPABASE_URL ?? "http://localhost:54321";
const SUPABASE_KEY_SAFE = SUPABASE_PUBLISHABLE_KEY ?? "placeholder-key";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL_SAFE, SUPABASE_KEY_SAFE, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
