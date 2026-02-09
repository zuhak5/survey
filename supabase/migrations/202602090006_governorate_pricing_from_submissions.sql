-- Compute governorate-level fare parameters from driver submissions.
-- This is used by admins to build a ride-sharing fare system (no manual entry required).

alter table public.governorate_pricing
  add column if not exists submission_count integer not null default 0,
  add column if not exists baseline_count integer not null default 0,
  add column if not exists jam_count integer not null default 0,
  add column if not exists night_count integer not null default 0,
  add column if not exists fit_sample_count integer not null default 0,
  add column if not exists fit_mae_iqd numeric,
  add column if not exists fit_rmse_iqd numeric,
  add column if not exists last_submission_at timestamptz;

comment on column public.governorate_pricing.submission_count is
  'Total submissions mapped to this governorate (start point).';

comment on column public.governorate_pricing.baseline_count is
  'Submissions in baseline segment (day + traffic=2) for this governorate.';

comment on column public.governorate_pricing.fit_sample_count is
  'Number of samples used for the regression fit (baseline segment with ETA).';

create or replace function public.refresh_governorate_pricing(p_min_samples integer default 25)
returns integer
language sql
security definer
set search_path = pg_catalog, public
as $$
  with
    all_submissions as (
      select
        s.start_governorate_code as governorate_code,
        s.price::numeric as price_iqd,
        (s.distance_m::numeric / 1000) as distance_km,
        (s.eta_s::numeric / 60) as duration_min,
        s.time_bucket,
        s.traffic_level,
        s.created_at
      from public.submissions s
      where s.start_governorate_code is not null
        and s.price is not null
        and s.distance_m is not null
        and s.distance_m > 0
    ),

    counts as (
      select
        governorate_code,
        count(*)::integer as submission_count,
        count(*) filter (where time_bucket = 12 and traffic_level = 2)::integer as baseline_count,
        count(*) filter (where traffic_level = 3)::integer as jam_count,
        count(*) filter (where time_bucket = 22)::integer as night_count,
        max(created_at) as last_submission_at
      from all_submissions
      group by governorate_code
    ),

    baseline_fit as (
      select
        governorate_code,
        price_iqd,
        distance_km,
        duration_min
      from all_submissions
      where time_bucket = 12
        and traffic_level = 2
        and duration_min is not null
        and distance_km between 0.3 and 30
        and duration_min between 1 and 180
        and price_iqd between 1000 and 200000
    ),

    sums as (
      select
        governorate_code,
        count(*)::numeric as n,
        sum(distance_km)::numeric as sx1,
        sum(duration_min)::numeric as sx2,
        sum(price_iqd)::numeric as sy,
        sum(distance_km * distance_km)::numeric as sx1x1,
        sum(duration_min * duration_min)::numeric as sx2x2,
        sum(distance_km * duration_min)::numeric as sx1x2,
        sum(distance_km * price_iqd)::numeric as sx1y,
        sum(duration_min * price_iqd)::numeric as sx2y
      from baseline_fit
      group by governorate_code
    ),

    coeff_raw as (
      select
        s.governorate_code,
        s.n::integer as fit_sample_count,
        -- Normal equation for 3 variables: [1, km, min].
        (
          (s.n * (s.sx1x1 * s.sx2x2 - s.sx1x2 * s.sx1x2))
          - (s.sx1 * (s.sx1 * s.sx2x2 - s.sx1x2 * s.sx2))
          + (s.sx2 * (s.sx1 * s.sx1x2 - s.sx1x1 * s.sx2))
        ) as det_a,

        s.sy as b1,
        s.sx1y as b2,
        s.sx2y as b3,

        s.sx1 as a12,
        s.sx2 as a13,
        s.sx1x1 as a22,
        s.sx1x2 as a23,
        s.sx2x2 as a33,
        s.n as a11,
        s.sx1 as a21,
        s.sx2 as a31,
        s.sx1x2 as a32
      from sums s
    ),

    coeff as (
      select
        c.governorate_code,
        c.fit_sample_count,
        case
          when c.fit_sample_count < p_min_samples then null
          when c.det_a is null or abs(c.det_a) < 1e-9 then null
          else (
            -- b0 (intercept)
            (
              (c.b1 * (c.a22 * c.a33 - c.a23 * c.a32))
              - (c.a12 * (c.b2 * c.a33 - c.a23 * c.b3))
              + (c.a13 * (c.b2 * c.a32 - c.a22 * c.b3))
            ) / c.det_a
          )
        end as base_iqd_raw,

        case
          when c.fit_sample_count < p_min_samples then null
          when c.det_a is null or abs(c.det_a) < 1e-9 then null
          else (
            -- b1 (km coefficient)
            (
              (c.a11 * (c.b2 * c.a33 - c.a23 * c.b3))
              - (c.b1 * (c.a21 * c.a33 - c.a23 * c.a31))
              + (c.a13 * (c.a21 * c.b3 - c.b2 * c.a31))
            ) / c.det_a
          )
        end as dist_per_km_raw,

        case
          when c.fit_sample_count < p_min_samples then null
          when c.det_a is null or abs(c.det_a) < 1e-9 then null
          else (
            -- b2 (minute coefficient)
            (
              (c.a11 * (c.a22 * c.b3 - c.b2 * c.a32))
              - (c.a12 * (c.a21 * c.b3 - c.b2 * c.a31))
              + (c.b1 * (c.a21 * c.a32 - c.a22 * c.a31))
            ) / c.det_a
          )
        end as time_per_min_raw
      from coeff_raw c
    ),

    coeff_rounded as (
      select
        governorate_code,
        fit_sample_count,
        -- Clamp and round to admin-friendly steps.
        greatest(0, round(coalesce(base_iqd_raw, 0) / 500) * 500)::integer as base_fare_iqd,
        greatest(0, round(coalesce(dist_per_km_raw, 0) / 50) * 50)::integer as distance_fare_iqd_per_km,
        greatest(0, round(coalesce(time_per_min_raw, 0) / 50) * 50)::integer as time_fare_iqd_per_min
      from coeff
      where base_iqd_raw is not null and dist_per_km_raw is not null and time_per_min_raw is not null
    ),

    fit_errors as (
      select
        b.governorate_code,
        count(*)::integer as fit_sample_count,
        percentile_cont(0.5) within group (order by abs(b.price_iqd - (cr.base_fare_iqd + cr.distance_fare_iqd_per_km * b.distance_km + cr.time_fare_iqd_per_min * b.duration_min))) as fit_mae_iqd,
        sqrt(avg(power(b.price_iqd - (cr.base_fare_iqd + cr.distance_fare_iqd_per_km * b.distance_km + cr.time_fare_iqd_per_min * b.duration_min), 2))) as fit_rmse_iqd
      from baseline_fit b
      join coeff_rounded cr on cr.governorate_code = b.governorate_code
      group by b.governorate_code
    ),

    min_fares as (
      select
        governorate_code,
        (round((percentile_cont(0.5) within group (order by price_iqd)) / 500) * 500)::integer as minimum_fare_iqd
      from all_submissions
      where time_bucket = 12
        and traffic_level = 2
        and distance_km <= 2
        and price_iqd between 1000 and 200000
      group by governorate_code
    ),

    surge_stats as (
      select
        s.governorate_code,
        percentile_cont(0.5) within group (order by (s.price_iqd / greatest(1000, (cr.base_fare_iqd + cr.distance_fare_iqd_per_km * s.distance_km + cr.time_fare_iqd_per_min * s.duration_min)))) as surge_p50,
        percentile_cont(0.9) within group (order by (s.price_iqd / greatest(1000, (cr.base_fare_iqd + cr.distance_fare_iqd_per_km * s.distance_km + cr.time_fare_iqd_per_min * s.duration_min)))) as surge_p90
      from all_submissions s
      join coeff_rounded cr on cr.governorate_code = s.governorate_code
      where s.traffic_level = 3
        and s.duration_min is not null
        and s.distance_km between 0.3 and 30
        and s.duration_min between 1 and 180
        and s.price_iqd between 1000 and 200000
      group by s.governorate_code
    ),

    stitched as (
      select
        gp.governorate_code,
        coalesce(cnt.submission_count, 0) as submission_count,
        coalesce(cnt.baseline_count, 0) as baseline_count,
        coalesce(cnt.jam_count, 0) as jam_count,
        coalesce(cnt.night_count, 0) as night_count,
        cnt.last_submission_at,

        cr.fit_sample_count as fit_sample_count,
        cr.base_fare_iqd as base_fare_iqd,
        cr.time_fare_iqd_per_min as time_fare_iqd_per_min,
        cr.distance_fare_iqd_per_km as distance_fare_iqd_per_km,

        coalesce(mf.minimum_fare_iqd, null) as minimum_fare_iqd,

        fe.fit_mae_iqd,
        fe.fit_rmse_iqd,

        ss.surge_p50,
        ss.surge_p90
      from public.governorate_pricing gp
      left join counts cnt on cnt.governorate_code = gp.governorate_code
      left join coeff_rounded cr on cr.governorate_code = gp.governorate_code
      left join min_fares mf on mf.governorate_code = gp.governorate_code
      left join fit_errors fe on fe.governorate_code = gp.governorate_code
      left join surge_stats ss on ss.governorate_code = gp.governorate_code
    ),

    updated as (
      update public.governorate_pricing gp
      set
        submission_count = s.submission_count,
        baseline_count = s.baseline_count,
        jam_count = s.jam_count,
        night_count = s.night_count,
        fit_sample_count = coalesce(s.fit_sample_count, 0),
        fit_mae_iqd = s.fit_mae_iqd,
        fit_rmse_iqd = s.fit_rmse_iqd,
        last_submission_at = s.last_submission_at,

        -- Only overwrite fare params if we have enough data to fit.
        base_fare_iqd = case when s.fit_sample_count >= p_min_samples then s.base_fare_iqd else gp.base_fare_iqd end,
        time_fare_iqd_per_min = case when s.fit_sample_count >= p_min_samples then s.time_fare_iqd_per_min else gp.time_fare_iqd_per_min end,
        distance_fare_iqd_per_km = case when s.fit_sample_count >= p_min_samples then s.distance_fare_iqd_per_km else gp.distance_fare_iqd_per_km end,
        minimum_fare_iqd = case when s.baseline_count >= 10 and s.minimum_fare_iqd is not null then s.minimum_fare_iqd else gp.minimum_fare_iqd end,

        surge_multiplier = case
          when s.fit_sample_count >= p_min_samples and s.surge_p50 is not null then
            greatest(1, least(10, round(s.surge_p50 * 20) / 20))
          else gp.surge_multiplier
        end,

        surge_cap = case
          when s.fit_sample_count >= p_min_samples and s.surge_p90 is not null then
            greatest(1, least(10, round(s.surge_p90 * 20) / 20))
          else gp.surge_cap
        end,

        updated_by = null
      from stitched s
      where gp.governorate_code = s.governorate_code
      returning 1
    )
  select count(*)::integer from updated;
$$;

-- Security: this refresh should only run on the server with the service role.
revoke execute on function public.refresh_governorate_pricing(integer) from public;
grant execute on function public.refresh_governorate_pricing(integer) to service_role;

