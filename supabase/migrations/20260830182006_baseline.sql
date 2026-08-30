-- Baseline: current persistent schema for the Mì Sài Gòn meal system.
-- Captures what already existed in the Mi-Saigon project (created ad hoc in the
-- dashboard) so a fresh environment can be rebuilt from migrations.
-- Buggy/legacy RPCs are intentionally NOT recreated here; see later migrations.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.locations (
  code          text primary key,
  name          text        not null,
  password      text        not null,          -- shared per-quán password (plaintext, parity with legacy system)
  monthly_limit integer     not null default 0,-- 0 = unlimited meals/month for this quán
  created_at    timestamptz not null default now()
);

create table if not exists public.members (
  code             text primary key,           -- e.g. kh_0002, gl_0005
  name             text        not null,
  phone            text,
  monthly_allowance integer    not null default 0, -- meals granted per calendar month (Asia/Ho_Chi_Minh)
  created_at       timestamptz not null default now()
);

create table if not exists public.meal_log (
  id            bigint generated always as identity primary key,
  member_code   text        not null references public.members(code),
  location_code text        not null references public.locations(code),
  portions      integer     not null default 1,
  created_at    timestamptz not null default now()
);

create index if not exists idx_meal_log_member_month   on public.meal_log (member_code, created_at);
create index if not exists idx_meal_log_location_month on public.meal_log (location_code, created_at);

-- ---------------------------------------------------------------------------
-- RLS: enabled with NO policies on purpose.
-- All client access goes through SECURITY DEFINER RPCs (see 20260830140300).
-- Direct table access by anon/authenticated is therefore denied.
-- ---------------------------------------------------------------------------

alter table public.locations enable row level security;
alter table public.members   enable row level security;
alter table public.meal_log  enable row level security;

-- ---------------------------------------------------------------------------
-- Safety net: auto-enable RLS on any future table created in public.
-- ---------------------------------------------------------------------------

create or replace function public.rls_auto_enable()
  returns event_trigger
  language plpgsql
  security definer
  set search_path to 'pg_catalog'
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name = 'public' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception when others then
        raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    end if;
  end loop;
end;
$$;

-- rls_auto_enable() must never be callable from the public API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls
      on ddl_command_end
      execute function public.rls_auto_enable();
  end if;
end;
$$;
