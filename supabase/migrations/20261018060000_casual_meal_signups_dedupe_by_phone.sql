-- (Da ap dung truc tiep len production truoc do, file nay chi de luu lai lich
-- su local cho dung voi production.) Chong cong gap suat khi 1 nguoi dang ky
-- 2 lan (ke ca o quan khac) -- doi signup_key tu "noi dung" (sdt + gio dang
-- ky) sang CHI so dien thoai, bat buoc phone not null, de 1 so dien thoai =
-- toi da 1 suat vang lai, toan he thong.
drop table if exists public.casual_meal_signups;

create table public.casual_meal_signups (
  signup_key    text primary key,
  full_name     text not null,
  phone         text not null,
  location_code text not null references public.locations(code),
  registered_at timestamptz not null,
  synced_at     timestamptz not null default now()
);

alter table public.casual_meal_signups enable row level security;
grant select, insert on public.casual_meal_signups to service_role;

comment on table public.casual_meal_signups is
  'TAM THOI - suat an vang lai cho khach dang ky Giai doan 1 trong dot khuyen mai cua quan. Dong bo mot chieu tu tab "Khach An" (Google Sheet) qua KhachVangLai.gs. signup_key = so dien thoai (1 nguoi = 1 suat vang lai duy nhat, toan he thong). Xoa bang nay + file KhachVangLai.gs (va trigger cua no) khi dot khuyen mai ket thuc.';
