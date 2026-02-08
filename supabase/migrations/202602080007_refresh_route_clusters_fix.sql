-- Fix function linting/runtime error by keeping aggregation CTE within a single statement.

create or replace function public.refresh_route_clusters(p_since timestamptz default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer := 0;
begin
  with agg as (
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
    group by 1, 2, 3, 4, 5
  ),
  upserted as (
    insert into public.route_clusters (
      start_bucket,
      end_bucket,
      time_bucket,
      day_of_week,
      vehicle_type,
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
      a.start_bucket,
      a.end_bucket,
      a.time_bucket,
      a.day_of_week,
      a.vehicle_type,
      a.centroid_start_lat,
      a.centroid_start_lng,
      a.centroid_end_lat,
      a.centroid_end_lng,
      a.median_price,
      a.iqr_price,
      a.price_variance,
      a.sample_count,
      public.compute_confidence_score(a.sample_count, a.price_variance, a.median_price),
      a.first_sample_at,
      a.last_updated
    from agg a
    on conflict (start_bucket, end_bucket, time_bucket, day_of_week, vehicle_type)
    do update set
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
      last_updated = excluded.last_updated
    returning 1
  ),
  mapped as (
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
    do update set cluster_id = excluded.cluster_id
    returning 1
  )
  select count(*) into v_rows from agg;

  return coalesce(v_rows, 0);
end;
$$;

revoke execute on function public.refresh_route_clusters(timestamptz) from public;
grant execute on function public.refresh_route_clusters(timestamptz) to service_role;

