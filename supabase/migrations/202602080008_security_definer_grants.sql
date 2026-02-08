-- Security Advisor: SECURITY DEFINER functions should not be executable by PUBLIC.

revoke execute on function public.handle_new_auth_user() from public;

do $$
begin
  -- Supabase Auth uses this role when writing to auth schema.
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.handle_new_auth_user() to supabase_auth_admin;
  end if;
end;
$$;

