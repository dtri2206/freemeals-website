-- Add phone number to get_member_info()'s result.
--
-- Why: the new app-facing API layer (edge function "misaigon", see
-- supabase/functions/misaigon) needs so_dien_thoai on the member-info
-- response. The website (quet.js) doesn't use this field but reads
-- results by name, so adding a column here is backward-compatible for it.
--
-- CREATE OR REPLACE can't change a function's RETURNS TABLE shape -- the
-- function has to be dropped and recreated. That wipes its grants, so
-- EXECUTE is re-granted to anon at the end, same as the original grant in
-- 20260830182107_lock_down_grants.sql.
drop function if exists public.get_member_info(text);

create function public.get_member_info(p_code text)
  returns table (
    code            text,
    name            text,
    phone           text,
    allowance       integer,
    used_this_month integer,
    remaining       integer
  )
  language sql
  security definer
  set search_path to 'public'
as $$
  with win as (
    select date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh'                        as month_start,
           (date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh') + interval '1 month') at time zone 'Asia/Ho_Chi_Minh' as month_end
  ),
  used as (
    select coalesce(sum(l.portions), 0) as n
    from public.meal_log l, win
    where l.member_code = p_code
      and l.created_at >= win.month_start
      and l.created_at <  win.month_end
  )
  select m.code,
         m.name,
         m.phone,
         m.monthly_allowance,
         used.n::integer,
         greatest(0, m.monthly_allowance - used.n)::integer
  from public.members m, used
  where m.code = p_code and m.is_active;
$$;

grant execute on function public.get_member_info(text) to anon;
