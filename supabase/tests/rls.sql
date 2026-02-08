-- Run with: supabase db test --linked (or psql against your Supabase DB)
-- Purpose: Verify drivers can only read/insert their own submissions while admin can read all.

begin;

-- Seed three auth users (driver A, driver B, admin)
insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-0000000000a1',
    'authenticated',
    'authenticated',
    'driver-a@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email"}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-0000000000b1',
    'authenticated',
    'authenticated',
    'driver-b@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email"}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-0000000000c1',
    'authenticated',
    'authenticated',
    'admin@example.com',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","role":"admin"}',
    '{}',
    now(),
    now()
  )
on conflict (id) do nothing;

-- Driver A inserts one submission
select set_config(
  'request.jwt.claim',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"role":"driver"}}',
  true
);

insert into public.submissions (
  driver_id,
  start_lat,
  start_lng,
  end_lat,
  end_lng,
  price,
  distance_m,
  time_bucket,
  day_of_week,
  vehicle_type
)
values (
  '00000000-0000-0000-0000-0000000000a1',
  33.3128,
  44.3615,
  33.3152,
  44.3661,
  9000,
  1200,
  9,
  1,
  'sedan'
);

-- Driver B should see zero rows for Driver A
select set_config(
  'request.jwt.claim',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","app_metadata":{"role":"driver"}}',
  true
);

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.submissions
  where driver_id = '00000000-0000-0000-0000-0000000000a1';

  if visible_count <> 0 then
    raise exception 'RLS failure: Driver B can read Driver A submissions';
  end if;
end;
$$;

-- Driver B should not be able to insert a submission on behalf of Driver A
do $$
begin
  begin
    insert into public.submissions (
      driver_id,
      start_lat,
      start_lng,
      end_lat,
      end_lng,
      price
    )
    values (
      '00000000-0000-0000-0000-0000000000a1',
      33.31,
      44.36,
      33.32,
      44.37,
      8500
    );

    raise exception 'RLS failure: Driver B inserted for Driver A';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

-- Admin should be able to read all submissions
select set_config(
  'request.jwt.claim',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","app_metadata":{"role":"admin"}}',
  true
);

do $$
declare
  admin_visible_count integer;
begin
  select count(*) into admin_visible_count from public.submissions;
  if admin_visible_count < 1 then
    raise exception 'Admin should be able to read submissions';
  end if;
end;
$$;

rollback;
