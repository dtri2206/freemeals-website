-- Per-member detail report: for the staff dashboard's "who ate on this day"
-- table. One row per (day, member, location) -- if a member checked in
-- multiple times at the same quán on the same day, their check-in times are
-- merged into a single cell instead of producing duplicate rows.
--
-- location_name only (no address concatenation): the fund has no physical
-- address data anywhere in the system. Quán Ăn sheet's column C, initially
-- assumed to be an address, turned out to be the quán's member-signup QR
-- code URL (public.locations.signup_qr_url) -- unrelated to this report.

drop view if exists public.report_daily_member_detail;

create view public.report_daily_member_detail as
select
  (m.created_at at time zone 'Asia/Ho_Chi_Minh')::date                       as day,
  string_agg(
    to_char(m.created_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS'),
    ', ' order by m.created_at
  )                                                                          as check_in_times,
  m.member_code,
  m.member_name,
  m.location_code,
  m.location_name,
  sum(m.portions)                                                            as portions
from public.meal_log m
group by 1, m.member_code, m.member_name, m.location_code, m.location_name
order by 1 desc, m.member_name;

revoke all on public.report_daily_member_detail from anon, authenticated;
grant select on public.report_daily_member_detail to fund_staff;
