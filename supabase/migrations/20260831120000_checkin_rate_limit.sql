-- Rate-limit checkin(): stop repeated wrong-password guesses from one
-- caller. Without this, checkin() could be called in a tight loop to
-- brute-force a quán's password as fast as the network allows.
--
-- Design notes (read before touching this again):
--  - checkin() identifies "which quán" purely by which password matches
--    -- no location code is sent -- so there is no single account to
--    lock the way a normal login would. We rate-limit by CALLER IP
--    instead: how many wrong-password attempts has this IP made lately.
--  - Rolling time window, not a mutable "locked_until" column: simpler,
--    avoids row-locking/race conditions between concurrent requests,
--    and expires on its own once the window passes.
--  - This defends against ONE source hammering the endpoint. It does
--    NOT defend against a distributed attack from many IPs at once --
--    that needs an edge/gateway layer in front of Supabase, a separate
--    problem from this fix.
--  - request_ip() reads the caller IP that PostgREST forwards via a
--    per-request setting. Verified live after applying (2026-08-31):
--    a wrong-password test call correctly logged a real IP, and a burst
--    of 10 rapid wrong-password calls correctly got blocked starting at
--    attempt 8.

create table if not exists public.checkin_attempts (
  id         bigint generated always as identity primary key,
  ip         inet,
  success    boolean     not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_checkin_attempts_ip_time
  on public.checkin_attempts (ip, created_at);

-- No client role ever queries this directly; only checkin() (SECURITY
-- DEFINER) reads/writes it. RLS on with no policies keeps it that way.
alter table public.checkin_attempts enable row level security;

create or replace function public.request_ip()
  returns inet
  language sql
  stable
  set search_path to 'public'
as $$
  select nullif(
    split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1),
    ''
  )::inet;
$$;

-- Matches the explicit-grants philosophy from lock_down_grants.sql:
-- Postgres auto-grants EXECUTE on new functions to PUBLIC by default,
-- so without this, anon could call request_ip() directly too. Harmless
-- on its own (it just echoes the caller's IP back), but we lock it down
-- anyway for consistency -- checkin() can still call it internally,
-- since it runs as the function owner, not as anon.
revoke execute on function public.request_ip() from public, anon, authenticated;

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
  v_tz                 constant text     := 'Asia/Ho_Chi_Minh';
  v_month_start         timestamptz      := date_trunc('month', now() at time zone v_tz) at time zone v_tz;
  v_month_end           timestamptz      := (date_trunc('month', now() at time zone v_tz) + interval '1 month') at time zone v_tz;
  v_location            public.locations%rowtype;
  v_member              public.members%rowtype;
  v_member_used         integer;
  v_location_used       integer;
  v_remaining           integer;
  v_ip                  inet             := public.request_ip();
  v_recent_failures     integer;
  v_rate_limit_window   constant interval := interval '5 minutes';
  v_rate_limit_max      constant integer  := 8;
begin
  -- Rate-limit gate: check BEFORE doing any real work (including the
  -- bcrypt password scan), so a locked-out IP can't even spend our
  -- database's CPU, let alone keep guessing.
  if v_ip is not null then
    select count(*) into v_recent_failures
    from public.checkin_attempts
    where ip = v_ip
      and success = false
      and created_at >= now() - v_rate_limit_window;

    if v_recent_failures >= v_rate_limit_max then
      return json_build_object('result', 'error', 'code', 'rate_limited',
        'message', 'Quá nhiều lần nhập sai mật khẩu. Vui lòng thử lại sau vài phút.');
    end if;
  end if;

  if p_portions is null or p_portions < 1 or p_portions > 2 then
    return json_build_object('result', 'error', 'code', 'bad_portions',
      'message', 'Số suất phải là 1 hoặc 2.');
  end if;

  select * into v_location
  from public.locations
  where is_active
    and password_hash = extensions.crypt(p_password, password_hash);

  if not found then
    insert into public.checkin_attempts (ip, success) values (v_ip, false);
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

  insert into public.checkin_attempts (ip, success) values (v_ip, true);

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
