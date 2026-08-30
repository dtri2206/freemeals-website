-- Phase 1 registration stays on Google Sheets (admin curates the Thành Viên tab
-- by hand, which then syncs into public.members). The half-built register() RPC
-- referenced a non-existent `registrations` table and is not used.

drop function if exists public.register(text, text, text, text);
