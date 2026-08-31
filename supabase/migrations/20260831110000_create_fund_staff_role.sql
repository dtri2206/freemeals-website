-- Read-only Postgres role for the fund's staff reporting dashboard (a BI
-- tool like Looker Studio, connected directly to Postgres -- not through
-- PostgREST/anon key, since staff need to run their own charts/filters).
--
-- Scope, deliberately narrow: SELECT on the 3 reporting views only.
-- No access to members / locations / meal_log directly -- so this
-- credential can never see the (now-hashed) quán password, member
-- phone numbers outside of reports, or write/delete anything.
--
-- This migration creates the role WITHOUT a password (`nologin` below,
-- flipped to `login` with a real password via a separate, unversioned
-- command). A password is a secret; secrets do not belong in git
-- history, even in a "temporary" or placeholder form -- so the role's
-- shape is versioned here, and its credential is set/rotated out of
-- band. See the fund's password manager entry for the current value.

create role fund_staff nologin;

grant usage on schema public to fund_staff;
grant select on public.report_daily,
                  public.report_monthly_by_location,
                  public.report_monthly_by_member
  to fund_staff;

comment on role fund_staff is
  'Read-only credential for the charity staff reporting dashboard (BI tool). SELECT on report_* views only.';
