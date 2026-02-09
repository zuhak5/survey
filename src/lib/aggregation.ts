import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AggregationRunResult = {
  clusters_refreshed: number;
  feature_rows_upserted: number;
  governorates_refreshed: number;
  started_at: string;
  finished_at: string;
};

export async function runAggregationNow(): Promise<AggregationRunResult> {
  const adminClient = createSupabaseAdminClient();
  const started = new Date().toISOString();

  const clusterRun = await adminClient.rpc("refresh_route_clusters");
  if (clusterRun.error) {
    throw new Error(clusterRun.error.message);
  }

  const featureRun = await adminClient.rpc("refresh_feature_store");
  if (featureRun.error) {
    throw new Error(featureRun.error.message);
  }

  const governorateRun = await adminClient.rpc("refresh_governorate_pricing");
  if (governorateRun.error) {
    throw new Error(governorateRun.error.message);
  }

  const finished = new Date().toISOString();
  return {
    clusters_refreshed: Number(clusterRun.data ?? 0),
    feature_rows_upserted: Number(featureRun.data ?? 0),
    governorates_refreshed: Number(governorateRun.data ?? 0),
    started_at: started,
    finished_at: finished,
  };
}
