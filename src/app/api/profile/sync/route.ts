import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/http";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonError("Authentication required", 401);
  }

  const { error } = await supabase.from("drivers").upsert(
    {
      id: user.id,
      phone: user.phone ?? null,
      display_name: user.user_metadata?.display_name ?? null,
    },
    { onConflict: "id", ignoreDuplicates: false },
  );

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({ status: "ok" });
}
