-- Add a way to REVOKE access (soft delete) and to keep an audit snapshot on
-- every meal, since meal_log only stored foreign-key codes.

-- --------------------------------------------------------------------------
-- Soft delete: the Thành Viên / Quán Ăn sheet sync flips is_active instead
-- of DELETEing (meal_log FKs make hard deletes impossible anyway).
-- --------------------------------------------------------------------------

alter table public.members   add column if not exists is_active boolean not null default true;
alter table public.locations add column if not exists is_active boolean not null default true;

-- --------------------------------------------------------------------------
-- Audit snapshot: record who ate and where, by name, at the time of the meal.
-- Survives later renames / deactivation in the source sheet.
-- --------------------------------------------------------------------------

alter table public.meal_log add column if not exists member_name   text;
alter table public.meal_log add column if not exists location_name text;

update public.meal_log m
set member_name = mem.name
from public.members mem
where mem.code = m.member_code
  and m.member_name is null;

update public.meal_log m
set location_name = loc.name
from public.locations loc
where loc.code = m.location_code
  and m.location_name is null;

-- From here on checkin() always populates both; enforce it.
alter table public.meal_log alter column member_name   set not null;
alter table public.meal_log alter column location_name set not null;
