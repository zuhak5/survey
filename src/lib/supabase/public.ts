import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

// Server-safe client for public (anon) calls.
// Uses the anon key and does not persist sessions.
export function createSupabasePublicClient() {
  return createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

