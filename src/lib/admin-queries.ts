import type { ClusterFilters } from "@/lib/validators";
import type { RouteCluster } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchClustersForAdmin(
  client: SupabaseClient,
  filters: ClusterFilters,
): Promise<RouteCluster[]> {
  let query = client
    .from("route_clusters")
    .select("*")
    .order("sample_count", { ascending: false })
    .limit(filters.limit ?? 300);

  if (filters.date_from) {
    query = query.gte("last_updated", filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte("last_updated", filters.date_to);
  }
  if (filters.time_bucket !== undefined) {
    query = query.eq("time_bucket", filters.time_bucket);
  }
  if (filters.day_of_week !== undefined) {
    query = query.eq("day_of_week", filters.day_of_week);
  }
  if (filters.vehicle_type) {
    query = query.eq("vehicle_type", filters.vehicle_type.trim().toLowerCase());
  }
  if (filters.min_count !== undefined) {
    query = query.gte("sample_count", filters.min_count);
  }
  if (filters.min_confidence !== undefined) {
    query = query.gte("confidence_score", filters.min_confidence);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RouteCluster[];
}

export function clustersToCsv(clusters: RouteCluster[]): string {
  const headers = [
    "cluster_id",
    "start_bucket",
    "end_bucket",
    "time_bucket",
    "day_of_week",
    "vehicle_type",
    "centroid_start_lat",
    "centroid_start_lng",
    "centroid_end_lat",
    "centroid_end_lng",
    "median_price",
    "iqr_price",
    "price_variance",
    "sample_count",
    "confidence_score",
    "first_sample_at",
    "last_updated",
  ];

  const rows = clusters.map((cluster) =>
    headers
      .map((header) => {
        const value = (cluster as Record<string, unknown>)[header];
        if (value === null || value === undefined) {
          return "";
        }
        const cell = String(value).replaceAll('"', '""');
        return `"${cell}"`;
      })
      .join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}
