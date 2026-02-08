insert into storage.buckets (id, name, public)
values ('training-exports', 'training-exports', false)
on conflict (id) do nothing;

drop policy if exists training_exports_bucket_admin_select on storage.objects;
create policy training_exports_bucket_admin_select
on storage.objects
for select
using (
  bucket_id = 'training-exports'
  and public.is_admin()
);

drop policy if exists training_exports_bucket_admin_insert on storage.objects;
create policy training_exports_bucket_admin_insert
on storage.objects
for insert
with check (
  bucket_id = 'training-exports'
  and public.is_admin()
);
