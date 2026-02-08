-- Security Advisor: install/move extensions into a dedicated schema (avoid `public`).

create schema if not exists extensions;

do $$
begin
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto'
      and n.nspname <> 'extensions'
  ) then
    execute 'alter extension pgcrypto set schema extensions';
  end if;
end;
$$;

