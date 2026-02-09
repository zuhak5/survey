import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http";

function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const adminState = await assertAdmin(request);
  if (!adminState.ok) {
    return adminState.response;
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("governorate_pricing")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return jsonError(error.message, 500);
  }

  const rows = data ?? [];
  const headers = [
    "governorate_code",
    "name_ar",
    "name_en",
    "submission_count",
    "baseline_count",
    "jam_count",
    "night_count",
    "fit_sample_count",
    "fit_mae_iqd",
    "fit_rmse_iqd",
    "base_fare_iqd",
    "time_fare_iqd_per_min",
    "distance_fare_iqd_per_km",
    "minimum_fare_iqd",
    "surge_multiplier",
    "surge_cap",
    "last_submission_at",
    "updated_at",
  ];

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((key) => csvEscape((row as Record<string, unknown>)[key])).join(","));
  }

  const csv = lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="governorate_pricing.csv"',
      "Cache-Control": "no-store",
    },
  });
}

