import { NextRequest, NextResponse } from "next/server";
import { clusterToSuggestResponse, fallbackSuggestResponse, findBestRouteCluster } from "@/lib/suggest";
import { parseLatLng } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = parseLatLng(searchParams.get("start"));
  const end = parseLatLng(searchParams.get("end"));

  if (!start || !end) {
    return jsonError("Query params 'start' and 'end' must be in lat,lng format", 400);
  }

  const timeBucketRaw = searchParams.get("time_bucket");
  const dayOfWeekRaw = searchParams.get("day_of_week");
  const parsedTimeBucket = timeBucketRaw !== null ? Number(timeBucketRaw) : undefined;
  const parsedDayOfWeek = dayOfWeekRaw !== null ? Number(dayOfWeekRaw) : undefined;

  if (
    parsedTimeBucket !== undefined &&
    (!Number.isInteger(parsedTimeBucket) || parsedTimeBucket < 0 || parsedTimeBucket > 23)
  ) {
    return jsonError("Invalid time_bucket. Expected integer 0..23", 400);
  }
  if (
    parsedDayOfWeek !== undefined &&
    (!Number.isInteger(parsedDayOfWeek) || parsedDayOfWeek < 0 || parsedDayOfWeek > 6)
  ) {
    return jsonError("Invalid day_of_week. Expected integer 0..6", 400);
  }

  let suggestion = fallbackSuggestResponse(start, end);

  try {
    const cluster = await findBestRouteCluster({
      start,
      end,
      time_bucket: parsedTimeBucket,
      day_of_week: parsedDayOfWeek,
      vehicle_type: searchParams.get("vehicle_type") ?? undefined,
    });

    if (cluster) {
      suggestion = clusterToSuggestResponse(cluster, start, end);
    }
  } catch {
    // keep fallback suggestion for resilience
  }

  try {
    const adminClient = createSupabaseAdminClient();
    await adminClient.from("predictions_log").insert({
      driver_id: null,
      start_lat: start.lat,
      start_lng: start.lng,
      end_lat: end.lat,
      end_lng: end.lng,
      suggested_price: suggestion.suggested_price,
      model_version: null,
      is_stub: true,
      metadata: {
        source: "predict-price",
        count: suggestion.count,
        confidence: suggestion.confidence,
      },
    });
  } catch {
    // prediction logging should not block response
  }

  return NextResponse.json({
    ...suggestion,
    model_version: null,
    is_stub: true,
  });
}
