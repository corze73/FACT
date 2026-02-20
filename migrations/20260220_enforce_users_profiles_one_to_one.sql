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
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_id_fkey_users
      FOREIGN KEY (id) REFERENCES users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure users.email is unique (identity table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_email_key'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END $$;

-- Indexes for browse/search performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_profiles_country ON profiles(country);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_country_city ON profiles(country, city);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_lower ON profiles (LOWER(full_name));
