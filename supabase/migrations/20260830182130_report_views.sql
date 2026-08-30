-- Reporting for the fund. Read these from the Supabase dashboard / SQL editor
-- or with the service_role key. NOT exposed to the anon key (they carry names).

create or replace view public.report_monthly_by_location as
select date_trunc('month', created_at at time zone 'Asia/Ho_Chi_Minh')::date as month,
       location_code,
       location_name,
       sum(portions)                                                         as portions,
       count(*)                                                              as visits,
       count(distinct member_code)                                           as unique_members
from public.meal_log
group by 1, 2, 3
order by 1 desc, 2;

create or replace view public.report_monthly_by_member as
select date_trunc('month', created_at at time zone 'Asia/Ho_Chi_Minh')::date as month,
       member_code,
       member_name,
       sum(portions)                                                         as portions,
       count(*)                                                              as visits
from public.meal_log
group by 1, 2, 3
order by 1 desc, 2;

create or replace view public.report_daily as
select (created_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
       sum(portions)                                       as portions,
       count(*)                                            as visits,
       count(distinct member_code)                         as unique_members,
       count(distinct location_code)                       as active_locations
from public.meal_log
group by 1
order by 1 desc;

revoke all on public.report_monthly_by_location from anon, authenticated;
revoke all on public.report_monthly_by_member   from anon, authenticated;
revoke all on public.report_daily               from anon, authenticated;
