-- Re-apply Supabase Advisor fixes (idempotent).
-- Some earlier migrations may have been applied before these fixes existed.
--
-- Fixes:
-- - SECURITY: 0011_function_search_path_mutable
-- - PERFORMANCE: 0003_auth_rls_initplan
-- - PERFORMANCE: 0006_multiple_permissive_policies

-- SECURITY: Ensure SECURITY DEFINER functions have an immutable, safe search_path.
alter function public.set_updated_at()
  set search_path = pg_catalog, public;

alter function public.compute_bucket(double precision, double precision, double precision)
  set search_path = pg_catalog, public;

alter function public.compute_confidence_score(integer, numeric, integer)
  set search_path = pg_catalog, public;

alter function public.is_admin()
  set search_path = pg_catalog, public;

-- PERFORMANCE: Replace auth.<function>() with (select auth.<function>()) so it runs once per query.

-- drivers
drop policy if exists drivers_select_own on public.drivers;
create policy drivers_select_own
on public.drivers
for select
to authenticated
using (((select auth.uid()) = id) or (select public.is_admin()));

drop policy if exists drivers_insert_own on public.drivers;
create policy drivers_insert_own
on public.drivers
for insert
to authenticated
with check (((select auth.uid()) = id) or (select public.is_admin()));

drop policy if exists drivers_update_own on public.drivers;
create policy drivers_update_own
on public.drivers
for update
to authenticated
using (((select auth.uid()) = id) or (select public.is_admin()))
with check (((select auth.uid()) = id) or (select public.is_admin()));

-- submissions
drop policy if exists submissions_insert_own on public.submissions;
create policy submissions_insert_own
on public.submissions
for insert
to authenticated
with check (((select auth.uid()) = driver_id) or (select public.is_admin()));

drop policy if exists submissions_select_own on public.submissions;
create policy submissions_select_own
on public.submissions
for select
to authenticated
using (((select auth.uid()) = driver_id) or (select public.is_admin()));

-- PERFORMANCE: Avoid FOR ALL admin policies that also apply to SELECT (duplicate permissive policies).

-- route_clusters
drop policy if exists route_clusters_select_authenticated on public.route_clusters;
create policy route_clusters_select_authenticated
on public.route_clusters
for select
to authenticated
using (true);

drop policy if exists route_clusters_admin_write on public.route_clusters;

drop policy if exists route_clusters_admin_insert on public.route_clusters;
create policy route_clusters_admin_insert
on public.route_clusters
for insert
to authenticated
with check ((select public.is_admin()));

drop policy if exists route_clusters_admin_update on public.route_clusters;
create policy route_clusters_admin_update
on public.route_clusters
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists route_clusters_admin_delete on public.route_clusters;
create policy route_clusters_admin_delete
on public.route_clusters
for delete
to authenticated
using ((select public.is_admin()));

-- submission_cluster_map (admin only)
drop policy if exists submission_cluster_map_admin_read on public.submission_cluster_map;
drop policy if exists submission_cluster_map_admin_write on public.submission_cluster_map;

drop policy if exists submission_cluster_map_admin_select on public.submission_cluster_map;
create policy submission_cluster_map_admin_select
on public.submission_cluster_map
for select
to authenticated
using ((select public.is_admin()));

drop policy if exists submission_cluster_map_admin_insert on public.submission_cluster_map;
create policy submission_cluster_map_admin_insert
on public.submission_cluster_map
for insert
to authenticated
with check ((select public.is_admin()));

drop policy if exists submission_cluster_map_admin_update on public.submission_cluster_map;
create policy submission_cluster_map_admin_update
on public.submission_cluster_map
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists submission_cluster_map_admin_delete on public.submission_cluster_map;
create policy submission_cluster_map_admin_delete
on public.submission_cluster_map
for delete
to authenticated
using ((select public.is_admin()));

-- predictions_log
drop policy if exists predictions_log_insert_own on public.predictions_log;
create policy predictions_log_insert_own
on public.predictions_log
for insert
to authenticated
with check (((select auth.uid()) = driver_id) or (select public.is_admin()));

drop policy if exists predictions_log_select_own on public.predictions_log;
create policy predictions_log_select_own
on public.predictions_log
for select
to authenticated
using (((select auth.uid()) = driver_id) or (select public.is_admin()));

drop policy if exists predictions_log_update_admin on public.predictions_log;
create policy predictions_log_update_admin
on public.predictions_log
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

