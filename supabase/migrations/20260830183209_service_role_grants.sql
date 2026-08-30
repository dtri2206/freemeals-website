-- The tables were created ad hoc and service_role was never granted DML on them
-- (it only had REFERENCES/TRIGGER/TRUNCATE). The Google Apps Script sync
-- authenticates as service_role via PostgREST, so it needs real table access.
-- service_role bypasses RLS, so no policies are involved.

grant select, insert, update, delete on public.members   to service_role;
grant select, insert, update, delete on public.locations to service_role;
grant select, insert, update, delete on public.meal_log  to service_role;

-- Reporting views: readable by the fund via the service key / dashboard only.
grant select on public.report_monthly_by_location to service_role;
grant select on public.report_monthly_by_member   to service_role;
grant select on public.report_daily               to service_role;
