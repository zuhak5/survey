-- Security Advisor: limit execution surface of SECURITY DEFINER jobs.
-- Only the Supabase service role (server-side) should be able to run aggregation jobs.
revoke execute on function public.refresh_route_clusters(timestamptz) from public;
revoke execute on function public.refresh_feature_store(timestamptz) from public;

grant execute on function public.refresh_route_clusters(timestamptz) to service_role;
grant execute on function public.refresh_feature_store(timestamptz) to service_role;

-- Performance Advisor: add indexes for foreign keys commonly used in joins/filters.
create index if not exists submission_cluster_map_cluster_id_idx
  on public.submission_cluster_map (cluster_id);

create index if not exists feature_store_driver_id_idx
  on public.feature_store (driver_id);

create index if not exists training_exports_created_by_idx
  on public.training_exports (created_by);

create index if not exists predictions_log_driver_id_idx
  on public.predictions_log (driver_id);

-- Performance: match suggest-price ordering (confidence first, then count).
create index if not exists route_clusters_confidence_count_idx
  on public.route_clusters (confidence_score desc, sample_count desc);

