import { NextRequest, NextResponse } from "next/server";
import { fallbackSuggestResponse, findBestRouteCluster, clusterToSuggestResponse } from "@/lib/suggest";
import { jsonError } from "@/lib/http";
import { parseLatLng } from "@/lib/pricing";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = parseLatLng(searchParams.get("start"));
  const end = parseLatLng(searchParams.get("end"));

  if (!start || !end) {
    return jsonError("Query params 'start' and 'end' must be in lat,lng format", 400);
  }

  const timeBucket = searchParams.get("time_bucket");
  const dayOfWeek = searchParams.get("day_of_week");
  const vehicleType = searchParams.get("vehicle_type") ?? undefined;
  const parsedTimeBucket = timeBucket !== null ? Number(timeBucket) : undefined;
  const parsedDayOfWeek = dayOfWeek !== null ? Number(dayOfWeek) : undefined;

  if (parsedTimeBucket !== undefined && (!Number.isInteger(parsedTimeBucket) || parsedTimeBucket < 0 || parsedTimeBucket > 23)) {
    return jsonError("Invalid time_bucket. Expected integer 0..23", 400);
  }
  if (parsedDayOfWeek !== undefined && (!Number.isInteger(parsedDayOfWeek) || parsedDayOfWeek < 0 || parsedDayOfWeek > 6)) {
    return jsonError("Invalid day_of_week. Expected integer 0..6", 400);
  }

  try {
    const cluster = await findBestRouteCluster({
      start,
      end,
      time_bucket: parsedTimeBucket,
      day_of_week: parsedDayOfWeek,
      vehicle_type: vehicleType,
    });

    if (!cluster) {
      return NextResponse.json(fallbackSuggestResponse(start, end));
    }

    return NextResponse.json(clusterToSuggestResponse(cluster, start, end));
  } catch {
    return NextResponse.json(fallbackSuggestResponse(start, end));
  }
}
