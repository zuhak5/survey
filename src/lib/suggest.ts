import {
  currentBaghdadTemporalBuckets,
  derivePresetPrices,
  haversineDistanceMeters,
  neighboringBucketKeys,
  suggestedPriceRange,
  type LatLng,
} from "@/lib/pricing";
import type { RouteCluster, SuggestPriceResponse } from "@/lib/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SuggestParams = {
  start: LatLng;
  end: LatLng;
  time_bucket?: number;
  day_of_week?: number;
  vehicle_type?: string;
};

function normalizeVehicleType(vehicleType?: string): string | undefined {
  if (!vehicleType) {
    return undefined;
  }
  return vehicleType.trim().toLowerCase();
}

async function queryCandidateClusters(
  params: SuggestParams,
  withTemporalFilters: boolean,
  withVehicleType: boolean,
): Promise<RouteCluster[]> {
  const adminClient = createSupabaseAdminClient();
  const startBuckets = neighboringBucketKeys(params.start);
  const endBuckets = neighboringBucketKeys(params.end);

  let query = adminClient
    .from("route_clusters")
    .select("*")
    .in("start_bucket", startBuckets)
    .in("end_bucket", endBuckets)
    .gte("sample_count", 1)
    .order("confidence_score", { ascending: false })
    .order("sample_count", { ascending: false })
    .limit(100);

  if (withTemporalFilters && params.time_bucket !== undefined && params.day_of_week !== undefined) {
    query = query.eq("time_bucket", params.time_bucket).eq("day_of_week", params.day_of_week);
  }

  if (withVehicleType) {
    const vehicleType = normalizeVehicleType(params.vehicle_type);
    if (vehicleType) {
      query = query.eq("vehicle_type", vehicleType);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as RouteCluster[];
}

function bestCluster(candidates: RouteCluster[]): RouteCluster | null {
  if (candidates.length === 0) {
    return null;
  }
  return candidates[0] ?? null;
}

export async function findBestRouteCluster(params: SuggestParams): Promise<RouteCluster | null> {
  const temporal = currentBaghdadTemporalBuckets();
  const scoped: SuggestParams = {
    ...params,
    time_bucket: params.time_bucket ?? temporal.time_bucket,
    day_of_week: params.day_of_week ?? temporal.day_of_week,
  };

  const passes: Array<[boolean, boolean]> = [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ];

  for (const [withTemporal, withVehicle] of passes) {
    const candidates = await queryCandidateClusters(scoped, withTemporal, withVehicle);
    const result = bestCluster(candidates);
    if (result) {
      return result;
    }
  }

  return null;
}

export function fallbackSuggestResponse(start: LatLng, end: LatLng): SuggestPriceResponse {
  const distance = haversineDistanceMeters(start, end);
  const [low, baseline, high] = derivePresetPrices(distance);
  return {
    suggested_price: baseline,
    price_range: [low, high],
    median: baseline,
    count: 0,
    confidence: 0,
    last_updated: null,
    cluster_id: null,
    start,
    end,
  };
}

export function clusterToSuggestResponse(
  cluster: RouteCluster,
  start: LatLng,
  end: LatLng,
): SuggestPriceResponse {
  return {
    suggested_price: cluster.median_price,
    price_range: suggestedPriceRange(cluster.median_price, cluster.iqr_price),
    median: cluster.median_price,
    count: cluster.sample_count,
    confidence: Number(cluster.confidence_score ?? 0),
    last_updated: cluster.last_updated,
    cluster_id: cluster.cluster_id,
    start,
    end,
  };
}
