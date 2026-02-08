import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { currentBaghdadTemporalBuckets, haversineDistanceMeters } from "@/lib/pricing";
import { jsonError } from "@/lib/http";
import { serverEnv } from "@/lib/env";
import { submitRouteSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = submitRouteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload", 400);
  }

  const payload = parsed.data;
  const distance_m = haversineDistanceMeters(payload.start, payload.end);
  const temporal = currentBaghdadTemporalBuckets();
  const bypassAllowed = serverEnv.TEST_AUTH_BYPASS_ENABLED;

  let user: { id: string } | null = null;
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> | null = null;

  try {
    supabase = await createSupabaseServerClient();
    const authState = await supabase.auth.getUser();
    user = authState.data.user ? { id: authState.data.user.id } : null;

    if (authState.error && !bypassAllowed) {
      return jsonError(authState.error.message, 401);
    }
  } catch (error) {
    if (!bypassAllowed) {
      return jsonError(error instanceof Error ? error.message : "Authentication failed", 401);
    }
  }

  const driverIdFromBypass = bypassAllowed
    ? payload.driver_id ?? serverEnv.TEST_AUTH_BYPASS_DRIVER_ID
    : undefined;
  const driverId = user?.id ?? driverIdFromBypass;

  if (!driverId) {
    return jsonError("Authentication required", 401);
  }

  if (!user && bypassAllowed && !serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({
      status: "ok",
      submission_id: crypto.randomUUID(),
      mode: "bypass_mock",
    });
  }

  const dbClient = user && supabase ? supabase : createSupabaseAdminClient();
  const submissionRow = {
    driver_id: driverId,
    client_request_id: payload.client_request_id ?? null,
    start_lat: payload.start.lat,
    start_lng: payload.start.lng,
    end_lat: payload.end.lat,
    end_lng: payload.end.lng,
    price: payload.price,
    distance_m,
    time_bucket: temporal.time_bucket,
    day_of_week: temporal.day_of_week,
    vehicle_type: payload.vehicle_type?.trim().toLowerCase() ?? null,
    traffic_level: payload.traffic_level ?? null,
  };

  let insertData: { id: string } | null = null;
  let insertError: { code?: string; message: string } | null = null;

  if (payload.client_request_id) {
    const insertAttempt = await dbClient
      .from("submissions")
      .insert(submissionRow)
      .select("id")
      .single();

    insertData = insertAttempt.data as { id: string } | null;
    insertError = insertAttempt.error;

    if (insertError?.code === "23505") {
      const existing = await dbClient
        .from("submissions")
        .select("id")
        .eq("driver_id", driverId)
        .eq("client_request_id", payload.client_request_id)
        .limit(1)
        .single();

      insertData = existing.data as { id: string } | null;
      insertError = existing.error;
    }
  } else {
    const insertAttempt = await dbClient
      .from("submissions")
      .insert(submissionRow)
      .select("id")
      .single();

    insertData = insertAttempt.data as { id: string } | null;
    insertError = insertAttempt.error;
  }

  if (insertError) {
    return jsonError(insertError.message, 500);
  }

  return NextResponse.json({
    status: "ok",
    submission_id: insertData?.id ?? null,
  });
}
