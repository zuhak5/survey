import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { haversineDistanceMeters } from "@/lib/pricing";
import { jsonError } from "@/lib/http";
import { serverEnv } from "@/lib/env";
import { submitRouteSchema } from "@/lib/validators";

function toTimeBucket(timeOfDay: "day" | "night"): number {
  // We reuse `time_bucket` (0..23) but treat it as a coarse segment to avoid schema churn.
  // Day ~= 12:00, night ~= 22:00 (Baghdad).
  return timeOfDay === "day" ? 12 : 22;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = submitRouteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload", 400);
  }

  const payload = parsed.data;
  const distance_m = haversineDistanceMeters(payload.start, payload.end);
  const bypassAllowed = serverEnv.TEST_AUTH_BYPASS_ENABLED;

  if (bypassAllowed && !serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({
      status: "ok",
      submission_id: crypto.randomUUID(),
      mode: "bypass_mock_no_db",
    });
  }

  const dbClient = createSupabaseAdminClient();
  const submissionRow = {
    driver_id: null,
    client_request_id: payload.client_request_id,
    start_lat: payload.start.lat,
    start_lng: payload.start.lng,
    end_lat: payload.end.lat,
    end_lng: payload.end.lng,
    start_label: payload.start_label ?? null,
    end_label: payload.end_label ?? null,
    price: payload.price,
    distance_m,
    eta_s: payload.eta_s ?? null,
    time_bucket: toTimeBucket(payload.time_of_day),
    day_of_week: null,
    vehicle_type: null,
    traffic_level: payload.traffic_level,
  };

  let insertData: { id: string } | null = null;
  let insertError: { code?: string; message: string } | null = null;

  const insertAttempt = await dbClient.from("submissions").insert(submissionRow).select("id").single();

  insertData = insertAttempt.data as { id: string } | null;
  insertError = insertAttempt.error;

  if (insertError?.code === "23505") {
    const existing = await dbClient
      .from("submissions")
      .select("id")
      .eq("client_request_id", payload.client_request_id)
      .limit(1)
      .single();

    insertData = existing.data as { id: string } | null;
    insertError = existing.error;
  }

  if (insertError) {
    return jsonError(insertError.message, 500);
  }

  return NextResponse.json({
    status: "ok",
    submission_id: insertData?.id ?? null,
  });
}
