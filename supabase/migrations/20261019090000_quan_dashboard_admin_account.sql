-- Tai khoan "admin" cho quan-dashboard: dang nhap bang username/password rieng
-- (khong phai ma quan), xem duoc du lieu CUA TAT CA quan thay vi chi 1 quan.
-- quan_login() RPC duoc mo rong: thu khop admin_accounts truoc, khong khop
-- thi roi lai logic quan cu (khong doi hanh vi dang nhap quan).

create table if not exists public.admin_accounts (
  username      text primary key,
  password_hash text        not null,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now()
);

-- Khong client nao duoc doc truc tiep; chi quan_login() (SECURITY DEFINER) dung.
alter table public.admin_accounts enable row level security;

-- Hash bcrypt san (khong ghi mat khau plaintext vao migration/git). Da tao
-- bang: select crypt('<mat khau admin>', gen_salt('bf'));
insert into public.admin_accounts (username, password_hash)
values ('admin', '$2a$06$DWgMNqB/inz.HUw30Y2qfOTO584hmeq./rT.h/cRjwfpvsbAhpega')
on conflict (username) do nothing;

create or replace function public.quan_login(p_code text, p_password text)
  returns json
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_location          public.locations%rowtype;
  v_admin             public.admin_accounts%rowtype;
  v_ip                inet             := public.request_ip();
  v_recent_failures   integer;
  v_rate_limit_window  constant interval := interval '5 minutes';
  v_rate_limit_max     constant integer  := 8;
begin
  if v_ip is not null then
    select count(*) into v_recent_failures
    from public.quan_login_attempts
    where ip = v_ip
      and success = false
      and created_at >= now() - v_rate_limit_window;

    if v_recent_failures >= v_rate_limit_max then
      return json_build_object('result', 'error', 'code', 'rate_limited',
        'message', 'Quá nhiều lần đăng nhập sai. Vui lòng thử lại sau vài phút.');
    end if;
  end if;

  -- Thu tai khoan admin truoc (username rieng, khong trung voi ma quan).
  select * into v_admin
  from public.admin_accounts
  where lower(username) = lower(trim(p_code))
    and is_active
    and password_hash = extensions.crypt(p_password, password_hash);

  if found then
    insert into public.quan_login_attempts (ip, success) values (v_ip, true);
    return json_build_object(
      'result',   'success',
      'code',     '__ADMIN__',
      'name',     'Quản trị viên (tất cả quán)',
      'is_admin', true
    );
  end if;

  select * into v_location
  from public.locations
  where code = p_code
    and is_active
    and password_hash = extensions.crypt(p_password, password_hash);

  if not found then
    insert into public.quan_login_attempts (ip, success) values (v_ip, false);
    return json_build_object('result', 'error', 'code', 'invalid_credentials',
      'message', 'Mã quán hoặc mật khẩu không đúng.');
  end if;

  insert into public.quan_login_attempts (ip, success) values (v_ip, true);

  return json_build_object(
    'result',   'success',
    'code',     v_location.code,
    'name',     v_location.name,
    'is_admin', false
  );
end;
$$;

comment on table public.admin_accounts
  is 'Tai khoan dang nhap quan-dashboard xem duoc TAT CA quan (khong gioi han theo location_code). So sanh truoc trong quan_login(); username "admin" rieng, khong phai ma quan.';
