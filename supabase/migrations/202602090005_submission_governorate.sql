-- Capture governorate (Iraq) at submission time (best-effort from Google reverse geocode).
-- This enables governorate-level analytics for building the ride-sharing fare system.

alter table public.submissions
  add column if not exists start_governorate_code text,
  add column if not exists end_governorate_code text;

comment on column public.submissions.start_governorate_code is
  'Normalized governorate code (18 Iraq governorates) for the start point, best-effort from reverse geocode.';

comment on column public.submissions.end_governorate_code is
  'Normalized governorate code (18 Iraq governorates) for the end point, best-effort from reverse geocode.';

create index if not exists submissions_start_governorate_idx
  on public.submissions (start_governorate_code);

create index if not exists submissions_end_governorate_idx
  on public.submissions (end_governorate_code);

