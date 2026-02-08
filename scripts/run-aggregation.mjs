import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const startedAt = new Date().toISOString();

const clusterRun = await client.rpc("refresh_route_clusters");
if (clusterRun.error) {
  console.error(clusterRun.error.message);
  process.exit(1);
}

const featureRun = await client.rpc("refresh_feature_store");
if (featureRun.error) {
  console.error(featureRun.error.message);
  process.exit(1);
}

console.log({
  startedAt,
  finishedAt: new Date().toISOString(),
  clusters_refreshed: Number(clusterRun.data ?? 0),
  feature_rows_upserted: Number(featureRun.data ?? 0),
});
