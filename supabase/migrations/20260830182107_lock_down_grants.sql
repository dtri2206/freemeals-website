-- Make the public API surface explicit: the anon key may call exactly four
-- RPCs and nothing else. Tables stay unreachable (RLS + no grants).

-- Start from a clean slate for API roles.
revoke execute on all functions in schema public from anon, authenticated;
revoke all privileges on all tables    in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

-- The only endpoints the website needs:
grant execute on function public.checkin(text, text, integer) to anon;
grant execute on function public.get_member_info(text)        to anon;
grant execute on function public.get_member_history(text)     to anon;
grant execute on function public.get_locations()              to anon;

-- Note: these four are SECURITY DEFINER, so Supabase's linter reports
-- "Public Can Execute SECURITY DEFINER Function". That is expected and
-- accepted here — each function validates input (quán password / member code)
-- before touching data, and RPC-only access is the whole security model.
comment on function public.checkin(text, text, integer)
  is 'Public RPC. Anon-executable SECURITY DEFINER by design (RPC-only access model).';
