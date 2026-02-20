-- Phase A: Enforce 1:1 users <-> profiles integrity
-- profiles is canonical for marketplace data; users is identity/auth.

-- Safety checks: stop if tables are missing or orphaned rows exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    RAISE EXCEPTION 'users table missing; cannot enforce profiles FK';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM profiles p
    LEFT JOIN users u ON u.id = p.id
    WHERE u.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Found profiles without matching users rows. Fix data before applying FK.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM users u
    LEFT JOIN profiles p ON p.id = u.id
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Found users without matching profiles rows. Fix data before applying FK.';
  END IF;
END $$;

-- Enforce 1:1 link (profiles.id -> users.id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_id_fkey_users'
      AND conrePhase A migration created: 20260220_enforce_users_profiles_one_to_one.sql.

What it does

Verifies users table exists.
Fails early if any users/profiles are orphaned (so it won’t apply silently).
Adds FK profiles.id → users.id with ON DELETE CASCADE.
Adds unique constraint on users.email.
Adds indexes for browse/search: user_type, city, country, country+city, lower(full_name).
Safety

Safe to run on Neon if and only if there are no orphaned rows. It will halt with a clear error if there are.
Confirm to proceed with Phase B (write-path consistency).
