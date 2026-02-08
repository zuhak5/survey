import type { User } from "@supabase/supabase-js";

export function isAdminUser(user: User | null): boolean {
  if (!user) {
    return false;
  }

  const roleFromAppMeta =
    typeof user.app_metadata?.role === "string" ? user.app_metadata.role : undefined;
  const roleFromUserMeta =
    typeof user.user_metadata?.role === "string" ? user.user_metadata.role : undefined;

  return roleFromAppMeta === "admin" || roleFromUserMeta === "admin";
}
