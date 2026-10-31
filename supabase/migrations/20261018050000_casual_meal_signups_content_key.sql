-- sheet_row (vi tri dong) lam khoa chong trung la khong an toan: xoa/chen
-- dong o giua Sheet lam cac dong phia duoi doi vi tri, khien nguoi dang ky
-- moi bi hieu nham la "da dong bo roi" (trung sheet_row voi nguoi cu) va bi
-- bo sot. Doi sang khoa theo NOI DUNG (sdt + gio dang ky chinh xac toi mili
-- giay) -- khong doi du Sheet bi xoa/chen dong o bat ky dau.
--
-- Bang con it du lieu test/tam thoi, dong bo lai duoc tu Sheet ngay nen an
-- toan de tao lai sach thay vi ALTER phuc tap.
drop table if exists public.casual_meal_signups;

create table public.casual_meal_signups (
  signup_key    text primary key,
  full_name     text not null,
  phone         text,
  location_code text not null references public.locations(code),
  registered_at timestamptz not null,
  synced_at     timestamptz not null default now()
);

alter table public.casual_meal_signups enable row level security;
grant select, insert on public.casual_meal_signups to service_role;

comment on table public.casual_meal_signups is
  'TAM THOI - suat an vang lai cho khach dang ky Giai doan 1 trong dot khuyen mai cua quan. Dong bo mot chieu tu tab "Khach An" (Google Sheet) qua KhachVangLai.gs, khoa chong trung la signup_key (noi dung, khong phai vi tri dong). Xoa bang nay + file KhachVangLai.gs (va trigger cua no) khi dot khuyen mai ket thuc.';
