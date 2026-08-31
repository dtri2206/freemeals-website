-- Stop storing quán passwords in plaintext.
--
-- Why: if the `locations` table ever leaks (an exposed backup, a stolen
-- credential, a future bug), a plaintext `password` column is usable by
-- an attacker instantly. A bcrypt hash is not reversible -- an attacker
-- who steals it still has to brute-force each guess through bcrypt's
-- deliberately slow algorithm, which is computationally impractical for
-- a reasonable password. See the migration below for how the hash is
-- produced and how the plaintext is discarded.

-- ---------------------------------------------------------------------------
-- pgcrypto gives us crypt()/gen_salt() -- the functions bcrypt hashing needs.
-- Supabase convention: install extensions into their own `extensions`
-- schema, not `public`, so `public` stays free of extension-owned objects.
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

-- New column to hold the hash. Nullable for now -- we fill it in below,
-- then lock it down to NOT NULL once every row has one.
alter table public.locations add column if not exists password_hash text;

-- Backfill: hash every existing plaintext password.
-- gen_salt('bf') = a fresh random Blowfish salt per row (the 'bf' in
-- bcrypt literally stands for Blowfish). The salt is why two quán with
-- the identical password end up with two completely different hashes --
-- it defeats precomputed "rainbow table" lookups.
update public.locations
set password_hash = extensions.crypt(password, extensions.gen_salt('bf'))
where password_hash is null;

alter table public.locations alter column password_hash set not null;

-- ---------------------------------------------------------------------------
-- Trigger: from now on, ANY insert/update that sets `password` gets it
-- hashed automatically, and the plaintext is wiped before the row is
-- ever written to disk. This means:
--   - google-apps-script.gs's sync keeps sending plaintext `password` in
--     the JSON payload exactly as it does today -- NOTHING about the
--     sync code needs to change.
--   - the plaintext only ever exists in-flight (in the HTTPS request,
--     already encrypted in transit) and for a moment inside this
--     trigger -- never at rest in the table.
--   - `password` therefore always reads back as NULL after being
--     written. That's intentional: think of it as a write-only input
--     slot, not a real stored value anymore.
-- ---------------------------------------------------------------------------
create or replace function public.hash_location_password()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if new.password is not null and new.password <> '' then
    new.password_hash := extensions.crypt(new.password, extensions.gen_salt('bf'));
  end if;
  new.password := null;
  return new;
end;
$$;

drop trigger if exists trg_hash_location_password on public.locations;
create trigger trg_hash_location_password
  before insert or update on public.locations
  for each row
  execute function public.hash_location_password();
