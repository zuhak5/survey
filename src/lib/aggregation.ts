import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

export type AggregationRunResult = {
  clusters_refreshed: number;
  feature_rows_upserted: number;
  governorates_refreshed: number;
  started_at: string;
  finished_at: string;
};

export async function runAggregationNow(): Promise<AggregationRunResult> {
  const started = new Date().toISOString();

  // If a service role key is configured (e.g. for automation/cron), keep the direct RPC path.
  if (serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    const adminClient = createSupabaseAdminClient();

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

  // App-only path: requires an authenticated admin session cookie.
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("run_aggregation_admin");
  if (error) {
    throw new Error(error.message);
  }

  const payload =
    (data as {
      clusters_refreshed?: number;
      feature_rows_upserted?: number;
      governorates_refreshed?: number;
    } | null) ?? null;

  const finished = new Date().toISOString();
  return {
    clusters_refreshed: Number(payload?.clusters_refreshed ?? 0),
    feature_rows_upserted: Number(payload?.feature_rows_upserted ?? 0),
    governorates_refreshed: Number(payload?.governorates_refreshed ?? 0),
    started_at: started,
    finished_at: finished,
  };
}
