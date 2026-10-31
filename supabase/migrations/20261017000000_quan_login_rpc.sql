-- RPC cho trang dashboard quán (quan-dashboard/, deploy rieng tren Vercel):
-- quán nhập "mã quán" + "mật khẩu quán" (giống mật khẩu đã dùng ở đăng ký
-- Giai đoạn 1 / quét suất ăn), RPC verify rồi trả về thông tin quán. App
-- Next.js tự giữ session (cookie ký bằng SESSION_SECRET), các API tracking/
-- report dùng SERVICE_ROLE_KEY ở server (không bao giờ gửi ra browser),
-- tự lọc theo location_code lấy từ cookie đã verify -- không bao giờ tin
-- mã quán client tự gửi lên cho các API đó.
--
-- Rate-limit theo IP, copy nguyên pattern đã verify sống trong
-- checkin_rate_limit.sql (request_ip() đọc header x-forwarded-for do
-- PostgREST set; Next.js API route phải forward đúng IP client thật, không
-- phải IP server Vercel, khi gọi RPC này -- xem lib/supabase.ts).

create table if not exists public.quan_login_attempts (
  id         bigint generated always as identity primary key,
  ip         inet,
  success    boolean     not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_quan_login_attempts_ip_time
  on public.quan_login_attempts (ip, created_at);

-- Khong client nao duoc doc truc tiep; chi quan_login() (SECURITY DEFINER) dung.
alter table public.quan_login_attempts enable row level security;

create or replace function public.quan_login(p_code text, p_password text)
  returns json
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_location          public.locations%rowtype;
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
    'result', 'success',
    'code',   v_location.code,
    'name',   v_location.name
  );
end;
$$;

grant execute on function public.quan_login(text, text) to anon;

comment on function public.quan_login(text, text)
  is 'Public RPC cho trang dashboard quán (quan-dashboard/). Anon-executable SECURITY DEFINER by design (RPC-only access model), rate-limited theo IP giống checkin().';
