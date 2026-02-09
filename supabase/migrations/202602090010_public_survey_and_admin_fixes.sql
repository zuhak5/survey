-- Public survey + admin hardening (no service role key required for core flows).
--
-- Changes:
-- 1) Allow anonymous survey inserts into `public.submissions` (driver_id must be NULL).
-- 2) Allow public (anon) reads of aggregated `public.route_clusters` for the suggest-price API.
-- 3) Fix Storage policies to avoid per-row auth re-evaluation and to scope them to authenticated admins.
-- 4) Provide an admin-only RPC to run aggregation without requiring service role keys in the app.
-- 5) Schedule nightly aggregation via pg_cron.

-- 3) STORAGE: fix policy shapes (PERF: auth_rls_initplan) + scope to authenticated.
drop policy if exists training_exports_bucket_admin_select on storage.objects;
create policy training_exports_bucket_admin_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'training-exports'
  and (select public.is_admin())
);

drop policy if exists training_exports_bucket_admin_insert on storage.objects;
create policy training_exports_bucket_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'training-exports'
  and (select public.is_admin())
);

-- 1) SUBMISSIONS: allow anonymous inserts (no signup required).
-- Keep authenticated driver/admin insert policy, but also allow driver_id=NULL.
drop policy if exists submissions_insert_own on public.submissions;
create policy submissions_insert_own
on public.submissions
for insert
to authenticated
with check (
  driver_id is null
  or (select auth.uid()) = driver_id
  or (select public.is_admin())
);

drop policy if exists submissions_insert_anon on public.submissions;
create policy submissions_insert_anon
on public.submissions
for insert
to anon
with check (
  driver_id is null
  and client_request_id is not null
  and price >= 1000
);

-- 2) ROUTE CLUSTERS: allow public reads for suggestion lookups.
drop policy if exists route_clusters_select_authenticated on public.route_clusters;
drop policy if exists route_clusters_select_public on public.route_clusters;
create policy route_clusters_select_public
on public.route_clusters
for select
to anon, authenticated
using (true);

-- 4) Admin-only aggregation RPC (no service role needed).
create or replace function public.run_aggregation_admin()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_clusters integer;
  v_features integer;
  v_governorates integer;
begin
  if not (select public.is_admin()) then
    raise exception 'admin role required';
  end if;

  select public.refresh_route_clusters(null) into v_clusters;
  select public.refresh_feature_store(null) into v_features;
  select public.refresh_governorate_pricing(25) into v_governorates;

  return jsonb_build_object(
    'clusters_refreshed', coalesce(v_clusters, 0),
    'feature_rows_upserted', coalesce(v_features, 0),
    'governorates_refreshed', coalesce(v_governorates, 0)
  );
end;
$$;

revoke execute on function public.run_aggregation_admin() from public;
grant execute on function public.run_aggregation_admin() to authenticated;

-- 5) Nightly aggregation (runs inside Postgres via pg_cron).
-- Note: pg_cron uses the database timezone (Supabase defaults to UTC).
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'nightly_aggregation';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'nightly_aggregation',
    '0 1 * * *',
    $cron$select public.refresh_route_clusters(); select public.refresh_feature_store(); select public.refresh_governorate_pricing();$cron$
  );
end $$;
