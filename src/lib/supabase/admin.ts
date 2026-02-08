import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

export function createSupabaseAdminClient() {
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
