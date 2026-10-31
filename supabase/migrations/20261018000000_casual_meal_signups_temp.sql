-- TAM THOI (khuyen mai): quan dang promote chuong trinh, ai dang ky Giai doan 1
-- (duoc add vao tab "Khach An" trong Google Sheet) thi duoc tinh 1 suat an
-- vang lai luon -- khong qua Trang thai duyet, khong lien quan Thanh Vien
-- chinh thuc (meal_log/members).
--
-- De gon, de thao khi het dot khuyen mai:
--   - 1 bang rieng (khong dung chung meal_log) -- xoa bang nay la xong, khong
--     anh huong du lieu suat an chinh thuc.
--   - Dong bo mot chieu tu Sheet qua file Apps Script rieng (KhachVangLai.gs,
--     trigger rieng) -- khong dung chung syncToSupabase() trong Code.gs.
--   - sheet_row (so dong trong tab "Khach An", tu dong 2) lam khoa -- Apps
--     Script chi appendRow (khong chen/xoa giua chung) nen so dong on dinh,
--     dung lam khoa chong trung khi sync lap lai moi 10 phut.
create table if not exists public.casual_meal_signups (
  sheet_row     integer primary key,
  full_name     text not null,
  phone         text,
  location_code text not null references public.locations(code),
  registered_at timestamptz not null,
  synced_at     timestamptz not null default now()
);

alter table public.casual_meal_signups enable row level security;

comment on table public.casual_meal_signups is
  'TAM THOI - suat an vang lai cho khach dang ky Giai doan 1 trong dot khuyen mai cua quan. Dong bo mot chieu tu tab "Khach An" (Google Sheet) qua KhachVangLai.gs. Xoa bang nay + file KhachVangLai.gs (va trigger cua no) khi dot khuyen mai ket thuc.';
