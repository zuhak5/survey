import { jsonError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function assertAdmin() {
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
