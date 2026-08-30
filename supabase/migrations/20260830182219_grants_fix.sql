-- 20260830140400 revoked EXECUTE from anon/authenticated but not from PUBLIC,
-- which is where the default function grant actually lives. Revoke from PUBLIC
-- and re-grant only the intended callers.

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.checkin(text, text, integer)',
    'public.get_member_info(text)',
    'public.get_member_history(text)',
    'public.get_locations()'
  ]
  loop
    execute format('revoke execute on function %s from public, authenticated', fn);
    execute format('grant  execute on function %s to anon, service_role', fn);
  end loop;
end;
$$;
