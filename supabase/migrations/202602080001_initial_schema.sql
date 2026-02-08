create extension if not exists pgcrypto;
create extension if not exists postgis;

create table if not exists public.drivers (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  start_lat double precision not null,
  start_lng double precision not null,
  end_lat double precision not null,
  end_lng double precision not null,
  start_geog geography(point, 4326) generated always as (
    st_setsrid(st_makepoint(start_lng, start_lat), 4326)::geography
  ) stored,
  end_geog geography(point, 4326) generated always as (
    st_setsrid(st_makepoint(end_lng, end_lat), 4326)::geography
  ) stored,
  price integer not null check (price >= 500),
  client_request_id text,
  distance_m integer,
  time_bucket smallint check (time_bucket between 0 and 23),
  day_of_week smallint check (day_of_week between 0 and 6),
  vehicle_type text,
  traffic_level smallint check (traffic_level between 1 and 5),
  created_at timestamptz not null default now()
);

create table if not exists public.route_clusters (
  cluster_id uuid primary key default gen_random_uuid(),
  start_bucket text not null,
  end_bucket text not null,
  time_bucket smallint not null default -1 check (time_bucket between -1 and 23),
  day_of_week smallint not null default -1 check (day_of_week between -1 and 6),
  vehicle_type text not null default 'any',
  centroid_start geography(point, 4326),
  centroid_end geography(point, 4326),
  centroid_start_lat double precision not null,
  centroid_start_lng double precision not null,
  centroid_end_lat double precision not null,
  centroid_end_lng double precision not null,
  median_price integer not null check (median_price >= 500),
  iqr_price integer not null default 0 check (iqr_price >= 0),
  price_variance numeric,
  sample_count integer not null default 0,
  confidence_score numeric not null default 0 check (confidence_score >= 0 and confidence_score <= 1),
  first_sample_at timestamptz,
  last_updated timestamptz
);

create unique index if not exists route_clusters_lookup_unique
  on public.route_clusters (start_bucket, end_bucket, time_bucket, day_of_week, vehicle_type);

create table if not exists public.submission_cluster_map (
  submission_id uuid primary key references public.submissions (id) on delete cascade,
  cluster_id uuid not null references public.route_clusters (cluster_id) on delete cascade
);

create table if not exists public.feature_store (
  feature_id bigserial primary key,
  submission_id uuid not null unique references public.submissions (id) on delete cascade,
  driver_id uuid references public.drivers (id),
  cluster_id uuid references public.route_clusters (cluster_id),
  distance_m integer,
  time_bucket smallint,
  day_of_week smallint,
  median_history_7d integer,
  count_history_7d integer,
  variance_history_7d numeric,
  traffic_level_mode smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_exports (
  id uuid primary key default gen_random_uuid(),
  file_path text not null unique,
  file_type text not null default 'csv',
  row_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.drivers (id),
  created_at timestamptz not null default now()
);

create table if not exists public.predictions_log (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references public.drivers (id),
  start_lat double precision not null,
  start_lng double precision not null,
  end_lat double precision not null,
  end_lng double precision not null,
  suggested_price integer,
  predicted_price integer,
  model_version text,
  is_stub boolean not null default true,
  feedback_price integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists submissions_driver_created_idx
  on public.submissions (driver_id, created_at desc);
create unique index if not exists submissions_driver_request_unique_idx
  on public.submissions (driver_id, client_request_id)
  where client_request_id is not null;
create index if not exists submissions_vehicle_created_idx
  on public.submissions (vehicle_type, created_at desc);
create index if not exists submissions_time_day_idx
  on public.submissions (time_bucket, day_of_week);
create index if not exists submissions_start_geog_idx
  on public.submissions using gist (start_geog);
create index if not exists submissions_end_geog_idx
  on public.submissions using gist (end_geog);

create index if not exists route_clusters_sample_conf_idx
  on public.route_clusters (sample_count desc, confidence_score desc);
create index if not exists route_clusters_updated_idx
  on public.route_clusters (last_updated desc);
create index if not exists route_clusters_start_geog_idx
  on public.route_clusters using gist (centroid_start);
create index if not exists route_clusters_end_geog_idx
  on public.route_clusters using gist (centroid_end);

create index if not exists feature_store_submission_idx
  on public.feature_store (submission_id);
create index if not exists feature_store_cluster_idx
  on public.feature_store (cluster_id);

create index if not exists predictions_log_created_idx
  on public.predictions_log (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists feature_store_set_updated_at on public.feature_store;
create trigger feature_store_set_updated_at
before update on public.feature_store
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.drivers (id, phone, display_name)
  values (
    new.id,
    new.phone,
    coalesce(new.raw_user_meta_data ->> 'display_name', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

create or replace function public.compute_bucket(
  lat double precision,
  lng double precision,
  grid_size double precision default 0.0015
)
returns text
language sql
immutable
as $$
  select floor(lat / grid_size)::bigint::text || ':' || floor(lng / grid_size)::bigint::text;
$$;

create or replace function public.compute_confidence_score(
  sample_count integer,
  variance numeric,
  median_price integer
)
returns numeric
language sql
immutable
as $$
  select
    greatest(
      0,
      least(
        1,
        (least(1, (ln(sample_count + 1) / ln(10)) / 3))
        * (1 - least(1, coalesce(variance, 0) / power(greatest(median_price, 1), 2)))
      )
    );
$$;

create or replace function public.refresh_route_clusters(p_since timestamptz default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer := 0;
begin
  create temporary table if not exists tmp_cluster_agg (
    start_bucket text,
    end_bucket text,
    time_bucket smallint,
    day_of_week smallint,
    vehicle_type text,
    centroid_start_lat double precision,
    centroid_start_lng double precision,
    centroid_end_lat double precision,
    centroid_end_lng double precision,
    median_price integer,
    iqr_price integer,
    price_variance numeric,
    sample_count integer,
    first_sample_at timestamptz,
    last_updated timestamptz
  ) on commit drop;

  truncate table tmp_cluster_agg;

  insert into tmp_cluster_agg
  select
    public.compute_bucket(s.start_lat, s.start_lng) as start_bucket,
    public.compute_bucket(s.end_lat, s.end_lng) as end_bucket,
    coalesce(s.time_bucket, -1) as time_bucket,
    coalesce(s.day_of_week, -1) as day_of_week,
    coalesce(nullif(lower(s.vehicle_type), ''), 'any') as vehicle_type,
    avg(s.start_lat) as centroid_start_lat,
    avg(s.start_lng) as centroid_start_lng,
    avg(s.end_lat) as centroid_end_lat,
    avg(s.end_lng) as centroid_end_lng,
    round(percentile_cont(0.5) within group (order by s.price))::integer as median_price,
    greatest(
      0,
      round(
        percentile_cont(0.75) within group (order by s.price)
        - percentile_cont(0.25) within group (order by s.price)
      )::integer
    ) as iqr_price,
    coalesce(var_samp(s.price), 0) as price_variance,
    count(*)::integer as sample_count,
    min(s.created_at) as first_sample_at,
    max(s.created_at) as last_updated
  from public.submissions s
  where p_since is null or s.created_at >= p_since
  group by 1, 2, 3, 4, 5;

  select count(*) into v_rows from tmp_cluster_agg;

  insert into public.route_clusters (
    start_bucket,
    end_bucket,
    time_bucket,
    day_of_week,
    vehicle_type,
    centroid_start,
    centroid_end,
    centroid_start_lat,
    centroid_start_lng,
    centroid_end_lat,
    centroid_end_lng,
    median_price,
    iqr_price,
    price_variance,
    sample_count,
    confidence_score,
    first_sample_at,
    last_updated
  )
  select
    t.start_bucket,
    t.end_bucket,
    t.time_bucket,
    t.day_of_week,
    t.vehicle_type,
    st_setsrid(st_makepoint(t.centroid_start_lng, t.centroid_start_lat), 4326)::geography,
    st_setsrid(st_makepoint(t.centroid_end_lng, t.centroid_end_lat), 4326)::geography,
    t.centroid_start_lat,
    t.centroid_start_lng,
    t.centroid_end_lat,
    t.centroid_end_lng,
    t.median_price,
    t.iqr_price,
    t.price_variance,
    t.sample_count,
    public.compute_confidence_score(t.sample_count, t.price_variance, t.median_price),
    t.first_sample_at,
    t.last_updated
  from tmp_cluster_agg t
  on conflict (start_bucket, end_bucket, time_bucket, day_of_week, vehicle_type)
  do update set
    centroid_start = excluded.centroid_start,
    centroid_end = excluded.centroid_end,
    centroid_start_lat = excluded.centroid_start_lat,
    centroid_start_lng = excluded.centroid_start_lng,
    centroid_end_lat = excluded.centroid_end_lat,
    centroid_end_lng = excluded.centroid_end_lng,
    median_price = excluded.median_price,
    iqr_price = excluded.iqr_price,
    price_variance = excluded.price_variance,
    sample_count = excluded.sample_count,
    confidence_score = excluded.confidence_score,
    first_sample_at = excluded.first_sample_at,
    last_updated = excluded.last_updated;

  insert into public.submission_cluster_map (submission_id, cluster_id)
  select
    s.id as submission_id,
    rc.cluster_id
  from public.submissions s
  join public.route_clusters rc
    on rc.start_bucket = public.compute_bucket(s.start_lat, s.start_lng)
   and rc.end_bucket = public.compute_bucket(s.end_lat, s.end_lng)
   and rc.time_bucket = coalesce(s.time_bucket, -1)
   and rc.day_of_week = coalesce(s.day_of_week, -1)
   and rc.vehicle_type = coalesce(nullif(lower(s.vehicle_type), ''), 'any')
  where p_since is null or s.created_at >= p_since
  on conflict (submission_id)
  do update set cluster_id = excluded.cluster_id;

  return coalesce(v_rows, 0);
end;
$$;

create or replace function public.refresh_feature_store(p_since timestamptz default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer := 0;
begin
  with candidates as (
    select s.*
    from public.submissions s
    left join public.feature_store fs on fs.submission_id = s.id
    where fs.submission_id is null
      and (p_since is null or s.created_at >= p_since)
  ),
  enriched as (
    select
      c.id as submission_id,
      c.driver_id,
      scm.cluster_id,
      c.distance_m,
      coalesce(c.time_bucket, -1) as time_bucket,
      coalesce(c.day_of_week, -1) as day_of_week,
      (
        select round(percentile_cont(0.5) within group (order by s2.price))::integer
        from public.submissions s2
        where s2.created_at between c.created_at - interval '7 days' and c.created_at
          and public.compute_bucket(s2.start_lat, s2.start_lng) = public.compute_bucket(c.start_lat, c.start_lng)
          and public.compute_bucket(s2.end_lat, s2.end_lng) = public.compute_bucket(c.end_lat, c.end_lng)
      ) as median_history_7d,
      (
        select count(*)::integer
        from public.submissions s2
        where s2.created_at between c.created_at - interval '7 days' and c.created_at
          and public.compute_bucket(s2.start_lat, s2.start_lng) = public.compute_bucket(c.start_lat, c.start_lng)
          and public.compute_bucket(s2.end_lat, s2.end_lng) = public.compute_bucket(c.end_lat, c.end_lng)
      ) as count_history_7d,
      (
        select coalesce(var_samp(s2.price), 0)
        from public.submissions s2
        where s2.created_at between c.created_at - interval '7 days' and c.created_at
          and public.compute_bucket(s2.start_lat, s2.start_lng) = public.compute_bucket(c.start_lat, c.start_lng)
          and public.compute_bucket(s2.end_lat, s2.end_lng) = public.compute_bucket(c.end_lat, c.end_lng)
      ) as variance_history_7d,
      (
        select s2.traffic_level
        from public.submissions s2
        where s2.created_at between c.created_at - interval '7 days' and c.created_at
          and public.compute_bucket(s2.start_lat, s2.start_lng) = public.compute_bucket(c.start_lat, c.start_lng)
          and public.compute_bucket(s2.end_lat, s2.end_lng) = public.compute_bucket(c.end_lat, c.end_lng)
          and s2.traffic_level is not null
        group by s2.traffic_level
        order by count(*) desc, s2.traffic_level desc
        limit 1
      ) as traffic_level_mode
    from candidates c
    left join public.submission_cluster_map scm
      on scm.submission_id = c.id
  )
  insert into public.feature_store (
    submission_id,
    driver_id,
    cluster_id,
    distance_m,
    time_bucket,
    day_of_week,
    median_history_7d,
    count_history_7d,
    variance_history_7d,
    traffic_level_mode
  )
  select
    e.submission_id,
    e.driver_id,
    e.cluster_id,
    e.distance_m,
    e.time_bucket,
    e.day_of_week,
    e.median_history_7d,
    e.count_history_7d,
    e.variance_history_7d,
    e.traffic_level_mode
  from enriched e
  on conflict (submission_id)
  do update set
    cluster_id = excluded.cluster_id,
    distance_m = excluded.distance_m,
    time_bucket = excluded.time_bucket,
    day_of_week = excluded.day_of_week,
    median_history_7d = excluded.median_history_7d,
    count_history_7d = excluded.count_history_7d,
    variance_history_7d = excluded.variance_history_7d,
    traffic_level_mode = excluded.traffic_level_mode;

  get diagnostics v_rows = row_count;
  return coalesce(v_rows, 0);
end;
$$;
