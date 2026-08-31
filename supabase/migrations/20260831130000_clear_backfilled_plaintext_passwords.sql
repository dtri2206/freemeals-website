-- Bug fix: 20260831090000's backfill set password_hash for every row but
-- never cleared the original plaintext `password` column -- the trigger
-- added in that same migration only fires on FUTURE inserts/updates, not
-- on rows that already existed. Caught by re-querying after applying:
-- password_hash was populated everywhere, but password was still non-null
-- everywhere too. This finishes the job for the rows that predate the
-- trigger.
-- `password` was declared NOT NULL in baseline.sql (back when it was
-- the only credential column) -- has to be dropped before any row can
-- have it cleared.
alter table public.locations alter column password drop not null;

update public.locations
set password = null
where password_hash is not null
  and password is not null;
