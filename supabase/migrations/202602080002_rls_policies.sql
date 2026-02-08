create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

alter table public.drivers enable row level security;
alter table public.submissions enable row level security;
alter table public.route_clusters enable row level security;
alter table public.submission_cluster_map enable row level security;
alter table public.feature_store enable row level security;
alter table public.training_exports enable row level security;
alter table public.predictions_log enable row level security;

drop policy if exists drivers_select_own on public.drivers;
create policy drivers_select_own
on public.drivers
for select
using (auth.uid() = id or public.is_admin());

drop policy if exists drivers_insert_own on public.drivers;
create policy drivers_insert_own
on public.drivers
for insert
with check (auth.uid() = id or public.is_admin());

drop policy if exists drivers_update_own on public.drivers;
create policy drivers_update_own
on public.drivers
for update
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

drop policy if exists submissions_insert_own on public.submissions;
create policy submissions_insert_own
on public.submissions
for insert
with check (auth.uid() = driver_id or public.is_admin());

drop policy if exists submissions_select_own on public.submissions;
create policy submissions_select_own
on public.submissions
for select
using (auth.uid() = driver_id or public.is_admin());

drop policy if exists route_clusters_select_authenticated on public.route_clusters;
create policy route_clusters_select_authenticated
on public.route_clusters
for select
using (auth.role() = 'authenticated' or public.is_admin());

drop policy if exists route_clusters_admin_write on public.route_clusters;
create policy route_clusters_admin_write
on public.route_clusters
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists submission_cluster_map_admin_read on public.submission_cluster_map;
create policy submission_cluster_map_admin_read
on public.submission_cluster_map
for select
using (public.is_admin());

drop policy if exists submission_cluster_map_admin_write on public.submission_cluster_map;
create policy submission_cluster_map_admin_write
on public.submission_cluster_map
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists feature_store_admin_only on public.feature_store;
create policy feature_store_admin_only
on public.feature_store
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists training_exports_admin_only on public.training_exports;
create policy training_exports_admin_only
on public.training_exports
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists predictions_log_insert_own on public.predictions_log;
create policy predictions_log_insert_own
on public.predictions_log
for insert
with check (auth.uid() = driver_id or public.is_admin());

drop policy if exists predictions_log_select_own on public.predictions_log;
create policy predictions_log_select_own
on public.predictions_log
for select
using (auth.uid() = driver_id or public.is_admin());

drop policy if exists predictions_log_update_admin on public.predictions_log;
create policy predictions_log_update_admin
on public.predictions_log
for update
using (public.is_admin())
with check (public.is_admin());
