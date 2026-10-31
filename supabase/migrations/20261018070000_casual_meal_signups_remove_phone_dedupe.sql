-- Ben quy yeu cau KHONG check trung nguoi dang ky nua -- 1 nguoi duoc tinh
-- nhieu suat vang lai neu dang ky nhieu lan (khac thoi diem). signup_key
-- khong con la rang buoc "1 nguoi = 1 suat" nua, ma chi la khoa ky thuat de
-- 1 dong dang ky khong bi dong bo lap lai nhieu lan (quet sheet moi 10 phut).
-- Khong doi schema (signup_key van la text), chi cap nhat lai comment cho
-- dung voi hanh vi moi; KhachVangLai.gs se doi cach tao signup_key.
comment on table public.casual_meal_signups is
  'TAM THOI - suat an vang lai cho khach dang ky Giai doan 1 trong dot khuyen mai cua quan. Dong bo mot chieu tu tab "Khach An" (Google Sheet) qua KhachVangLai.gs. KHONG check trung nguoi dang ky (theo yeu cau cua quy) -- 1 nguoi dang ky nhieu lan duoc tinh nhieu suat. signup_key = so dien thoai + thoi gian dang ky, chi dung de tranh dong bo lap lai cung 1 dong khi quet sheet nhieu lan, khong phai de chong trung nguoi. Xoa bang nay + file KhachVangLai.gs (va trigger cua no) khi dot khuyen mai ket thuc.';
