-- Anonymous survey submissions (no signup required)

-- Allow submissions without an authenticated driver.
alter table public.submissions
  alter column driver_id drop not null;

-- Optional extra fields captured from the UI.
alter table public.submissions
  add column if not exists start_label text,
  add column if not exists end_label text,
  add column if not exists eta_s integer;

alter table public.submissions
  drop constraint if exists submissions_eta_s_check;

alter table public.submissions
  add constraint submissions_eta_s_check check (eta_s is null or eta_s >= 0);

-- Idempotency key (client generates UUID). Partial unique so existing nulls remain allowed.
create unique index if not exists submissions_client_request_id_unique
  on public.submissions (client_request_id)
  where client_request_id is not null;

