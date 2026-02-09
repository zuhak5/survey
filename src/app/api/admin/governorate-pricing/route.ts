import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/require-admin";
import { jsonError } from "@/lib/http";
import { governoratePricingUpsertSchema } from "@/lib/validators";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const adminState = await assertAdmin();
  if (!adminState.ok) {
    return adminState.response;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governorate_pricing")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({ rows: data ?? [] });
}

export async function PUT(request: NextRequest) {
  const adminState = await assertAdmin();
  if (!adminState.ok) {
    return adminState.response;
  }

  const body = await request.json().catch(() => null);
  const parsed = governoratePricingUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload", 400);
  }

  const supabase = await createSupabaseServerClient();

  // Always attribute updates to the current admin user.
  const rows = parsed.data.rows.map((row) => ({
    ...row,
    updated_by: adminState.user.id,
  }));

  const upsert = await supabase
    .from("governorate_pricing")
    .upsert(rows, { onConflict: "governorate_code" });

  if (upsert.error) {
    return jsonError(upsert.error.message, 500);
  }

  const { data, error } = await supabase
    .from("governorate_pricing")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({ status: "ok", rows: data ?? [] });
}
