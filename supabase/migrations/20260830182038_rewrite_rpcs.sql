-- Rewrite the client-facing RPCs. Fixes vs. the ad-hoc originals:
--   1. Month window computed in Asia/Ho_Chi_Minh, not UTC.
--   2. checkin() takes p_portions (1 or 2) and honours it in both quota checks.
--   3. Inactive members / locations are rejected.
--   4. meal_log rows get member_name / location_name snapshots.
--   5. Predictable JSON error contract: {result:'error', code, message} — no
--      raw Postgres exceptions leaking to the client. Success: {result:'success', ...}.
--
-- All functions are SECURITY DEFINER with a pinned search_path. They are the
-- ONLY way the anon key touches these tables (RLS denies everything else).

-- The original 2-arg checkin must go, or PostgREST cannot resolve the call.
drop function if exists public.checkin(text, text);

-- --------------------------------------------------------------------------
-- checkin: atomically record a meal, enforcing member allowance + quán limit.
-- --------------------------------------------------------------------------
create or replace function public.checkin(
  p_member_code text,
  p_password    text,
  p_portions    integer default 1
)
  returns json
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_tz            constant text := 'Asia/Ho_Chi_Minh';
  v_month_start   timestamptz := date_trunc('month', now() at time zone v_tz) at time zone v_tz;
  v_month_end     timestamptz := (date_trunc('month', now() at time zone v_tz) + interval '1 month') at time zone v_tz;
  v_location      public.locations%rowtype;
  v_member        public.members%rowtype;
  v_member_used   integer;
  v_location_used integer;
  v_remaining     integer;
begin
  if p_portions is null or p_portions < 1 or p_portions > 2 then
    return json_build_object('result', 'error', 'code', 'bad_portions',
      'message', 'Số suất phải là 1 hoặc 2.');
  end if;

  select * into v_location
  from public.locations
  where password = p_password and is_active;

  if not found then
    return json_build_object('result', 'error', 'code', 'invalid_password',
      'message', 'Mật khẩu không đúng.');
  end if;

  -- Serialise concurrent check-ins for THIS member (not the whole table).
  select * into v_member
  from public.members
  where code = p_member_code and is_active
  for update;

  if not found then
    return json_build_object('result', 'error', 'code', 'member_not_found',
      'message', 'Không tìm thấy mã khách này.');
  end if;

  select coalesce(sum(portions), 0) into v_member_used
  from public.meal_log
  where member_code = p_member_code
    and created_at >= v_month_start
    and created_at <  v_month_end;

  v_remaining := v_member.monthly_allowance - v_member_used;

  if v_remaining < p_portions then
    return json_build_object('result', 'error', 'code', 'quota_exceeded',
      'message', format('Khách đã dùng %s/%s suất tháng này, không thể nhận thêm.',
                        v_member_used, v_member.monthly_allowance));
  end if;

  if v_location.monthly_limit > 0 then
    select coalesce(sum(portions), 0) into v_location_used
    from public.meal_log
    where location_code = v_location.code
      and created_at >= v_month_start
      and created_at <  v_month_end;

    if v_location_used + p_portions > v_location.monthly_limit then
      return json_build_object('result', 'error', 'code', 'location_limit_exceeded',
        'message', format('Quán đã bán %s/%s suất tháng này, không thể bán thêm.',
                          v_location_used, v_location.monthly_limit));
    end if;
  end if;

  insert into public.meal_log (member_code, member_name, location_code, location_name, portions)
  values (v_member.code, v_member.name, v_location.code, v_location.name, p_portions);

  return json_build_object(
    'result',        'success',
    'member_code',   v_member.code,
    'member_name',   v_member.name,
    'location_name', v_location.name,
    'portions',      p_portions,
    'remaining',     v_remaining - p_portions
  );
end;
$$;

-- --------------------------------------------------------------------------
-- get_member_info: card summary for the scanner screen.
-- Returns 0 rows if the code is unknown or inactive (client treats as "not found").
-- --------------------------------------------------------------------------
create or replace function public.get_member_info(p_code text)
  returns table (
    code            text,
    name            text,
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
         m.monthly_allowance,
         used.n::integer,
         greatest(0, m.monthly_allowance - used.n)::integer
  from public.members m, used
  where m.code = p_code and m.is_active;
$$;

-- --------------------------------------------------------------------------
-- get_member_history: this calendar month's meals for one member.
-- --------------------------------------------------------------------------
create or replace function public.get_member_history(p_code text)
  returns table (
    id            bigint,
    location_name text,
    portions      integer,
    created_at    timestamptz
  )
  language sql
  security definer
  set search_path to 'public'
as $$
  select l.id,
         l.location_name,
         l.portions,
         l.created_at
  from public.meal_log l
  where l.member_code = p_code
    and l.created_at >= date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh'
    and l.created_at <  (date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh') + interval '1 month') at time zone 'Asia/Ho_Chi_Minh'
  order by l.created_at desc;
$$;

-- --------------------------------------------------------------------------
-- get_locations: active quán list for the Phase 1 registration page.
-- --------------------------------------------------------------------------
create or replace function public.get_locations()
  returns table (code text, name text)
  language sql
  security definer
  set search_path to 'public'
as $$
  select code, name
  from public.locations
  where is_active
  order by code;
$$;
