import { jsonError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

function bearerTokenFromRequest(request: NextRequest): string | null {
  const auth = request.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ? match[1].trim() : null;
}

export async function assertAdmin(request?: NextRequest) {
  const bearer = request ? bearerTokenFromRequest(request) : null;

  // Support token-based admin calls for automation (in addition to cookie sessions).
  if (bearer) {
    const supabase = createClient(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      },
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(bearer);

    if (error || !user) {
      return { ok: false as const, response: jsonError("Authentication required", 401) };
    }

    const { data: isAdmin, error: isAdminError } = await supabase.rpc("is_admin");
    if (isAdminError || !isAdmin) {
      return { ok: false as const, response: jsonError("Admin role required", 403) };
    }

    return { ok: true as const, user };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false as const, response: jsonError("Authentication required", 401) };
  }

  const { data: isAdmin, error: isAdminError } = await supabase.rpc("is_admin");
  if (isAdminError || !isAdmin) {
    return { ok: false as const, response: jsonError("Admin role required", 403) };
  }

  return { ok: true as const, user };
}
