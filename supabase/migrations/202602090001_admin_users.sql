-- Admin allow-list (managed directly in DB) + Advisor warning fixes.
-- This migration:
-- 1) Adds `public.admin_users` (so you can grant admin access via SQL).
-- 2) Replaces `public.is_admin()` to check membership in `admin_users`.
-- 3) Re-applies Security/Performance Advisor fixes (search_path + RLS policy shapes).

-- Admin users table (DB-managed; app has no signup).
create table if not exists public.admin_users (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Allow-list of admin users. Insert auth user id here to grant admin access.';

alter table public.admin_users enable row level security;

-- Only allow a logged-in user to see their own admin row (useful for debugging).
drop policy if exists admin_users_select_own on public.admin_users;
create policy admin_users_select_own
on public.admin_users
for select
to authenticated
using ((select auth.uid()) = id);

-- No INSERT/UPDATE/DELETE policies on purpose.
-- Admin rows should be managed from the Supabase SQL editor / DB (postgres/service_role).

-- Replace is_admin() to consult the allow-list table.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.id = (select auth.uid())
  );
$$;

-- Security Advisor: SECURITY DEFINER functions should not be executable by PUBLIC.
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- SECURITY: 0011_function_search_path_mutable
alter function public.set_updated_at()
  set search_path = pg_catalog, public;

alter function public.compute_bucket(double precision, double precision, double precision)
  set search_path = pg_catalog, public;

alter function public.compute_confidence_score(integer, numeric, integer)
  set search_path = pg_catalog, public;

alter function public.is_admin()
  set search_path = pg_catalog, public;

-- PERFORMANCE: 0003_auth_rls_initplan + 0006_multiple_permissive_policies
-- Re-create RLS policies so auth.* calls are only evaluated once per query (via SELECT),
-- and to avoid FOR ALL policies that create duplicate permissive SELECT policies.

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

-- feature_store / training_exports (admin only)
drop policy if exists feature_store_admin_only on public.feature_store;
create policy feature_store_admin_only
on public.feature_store
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists training_exports_admin_only on public.training_exports;
create policy training_exports_admin_only
on public.training_exports
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

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
