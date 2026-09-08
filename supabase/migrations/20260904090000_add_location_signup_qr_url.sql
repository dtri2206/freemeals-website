-- Correction: Quán Ăn sheet's column C is NOT a physical address -- it's the
-- quán's member-signup QR code URL. Renamed here before any real data lands
-- in it (the column was only just added and google-apps-script.gs has not
-- run a sync with the old name yet).

alter table public.locations add column if not exists signup_qr_url text;
