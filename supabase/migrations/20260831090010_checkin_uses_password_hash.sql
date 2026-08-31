-- checkin(): verify the quán password against the bcrypt hash instead of
-- comparing plaintext. Everything else in the function is unchanged from
-- 20260830182038_rewrite_rpcs.sql -- only the `locations` lookup differs.
--
-- crypt(p_password, password_hash): pgcrypto reads the salt back out of
-- the stored hash and re-hashes the candidate with that same salt, so
-- this correctly checks "does p_password match THIS row's password" even
-- though we don't know in advance which quán the caller belongs to.

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
  where is_active
    and password_hash = extensions.crypt(p_password, password_hash);

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
