import { jsonError } from "@/lib/http";
import { isAdminUser } from "@/lib/auth";
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

  if (!isAdminUser(user)) {
    return { ok: false as const, response: jsonError("Admin role required", 403) };
  }

  return { ok: true as const, user };
}
