-- Governorate pricing configuration (Iraq - 18 governorates).
-- These values are used by the pricing engine (now + future ML) and are editable by admins.

create table if not exists public.governorate_pricing (
  governorate_code text primary key,
  name_ar text not null,
  name_en text not null,
  sort_order smallint not null default 0,

  -- Fare parameters (IQD).
  base_fare_iqd integer not null default 0 check (base_fare_iqd >= 0),
  time_fare_iqd_per_min integer not null default 0 check (time_fare_iqd_per_min >= 0),
  distance_fare_iqd_per_km integer not null default 1500 check (distance_fare_iqd_per_km >= 0),
  minimum_fare_iqd integer not null default 4000 check (minimum_fare_iqd >= 0),

  -- Surge controls.
  surge_multiplier numeric not null default 1 check (surge_multiplier >= 1 and surge_multiplier <= 10),
  surge_cap numeric not null default 2.5 check (surge_cap >= 1 and surge_cap <= 10),

  -- Rounding used for display/checkout.
  rounding_step_iqd integer not null default 500 check (rounding_step_iqd >= 1 and rounding_step_iqd <= 10000),

  notes text,

  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

create index if not exists governorate_pricing_sort_idx
  on public.governorate_pricing (sort_order asc);

-- Maintain updated_at.
drop trigger if exists governorate_pricing_set_updated_at on public.governorate_pricing;
create trigger governorate_pricing_set_updated_at
before update on public.governorate_pricing
for each row
execute function public.set_updated_at();

alter table public.governorate_pricing enable row level security;

-- Admin-only access (managed via `public.admin_users` and `public.is_admin()`).
drop policy if exists governorate_pricing_select_admin on public.governorate_pricing;
create policy governorate_pricing_select_admin
on public.governorate_pricing
for select
to authenticated
using ((select public.is_admin()));

drop policy if exists governorate_pricing_insert_admin on public.governorate_pricing;
create policy governorate_pricing_insert_admin
on public.governorate_pricing
for insert
to authenticated
with check ((select public.is_admin()));

drop policy if exists governorate_pricing_update_admin on public.governorate_pricing;
create policy governorate_pricing_update_admin
on public.governorate_pricing
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists governorate_pricing_delete_admin on public.governorate_pricing;
create policy governorate_pricing_delete_admin
on public.governorate_pricing
for delete
to authenticated
using ((select public.is_admin()));

-- Seed Iraq governorates (18).
insert into public.governorate_pricing (governorate_code, name_ar, name_en, sort_order)
values
  ('baghdad', 'بغداد', 'Baghdad', 1),
  ('basra', 'البصرة', 'Basra', 2),
  ('nineveh', 'نينوى', 'Nineveh', 3),
  ('anbar', 'الأنبار', 'Al Anbar', 4),
  ('diyala', 'ديالى', 'Diyala', 5),
  ('babil', 'بابل', 'Babil', 6),
  ('karbala', 'كربلاء', 'Karbala', 7),
  ('najaf', 'النجف', 'Najaf', 8),
  ('qadisiyyah', 'القادسية', 'Al-Qadisiyyah', 9),
  ('muthanna', 'المثنى', 'Al Muthanna', 10),
  ('dhi_qar', 'ذي قار', 'Dhi Qar', 11),
  ('maysan', 'ميسان', 'Maysan', 12),
  ('wasit', 'واسط', 'Wasit', 13),
  ('salah_al_din', 'صلاح الدين', 'Salah al-Din', 14),
  ('kirkuk', 'كركوك', 'Kirkuk', 15),
  ('erbil', 'أربيل', 'Erbil', 16),
  ('sulaymaniyah', 'السليمانية', 'Sulaymaniyah', 17),
  ('duhok', 'دهوك', 'Duhok', 18)
on conflict (governorate_code) do nothing;

