-- Bang moi khong ke thua default privileges nhu cac bang baseline -- cap rieng
-- cho service_role (Apps Script ghi, Next.js dashboard doc). anon/authenticated
-- khong duoc gi them (giu nguyen RLS deny-by-default).
grant select, insert on public.casual_meal_signups to service_role;
