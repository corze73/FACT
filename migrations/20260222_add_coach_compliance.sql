BEGIN;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS qualification_type TEXT,
  ADD COLUMN IF NOT EXISTS qualification_file_url TEXT,
  ADD COLUMN IF NOT EXISTS qualification_status TEXT NOT NULL DEFAULT 'incomplete',
  ADD COLUMN IF NOT EXISTS background_check_type TEXT,
  ADD COLUMN IF NOT EXISTS has_background_check BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS background_check_file_url TEXT,
  ADD COLUMN IF NOT EXISTS background_check_status TEXT NOT NULL DEFAULT 'incomplete',
  ADD COLUMN IF NOT EXISTS background_check_expires_at DATE NULL,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS verified_by UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_qualification_status_check'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_qualification_status_check
      CHECK (qualification_status IN ('incomplete', 'pending', 'verified', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_background_check_status_check'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_background_check_status_check
      CHECK (background_check_status IN ('incomplete', 'pending', 'verified', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_verified_by_fkey'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_verified_by_fkey
      FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_qualification_status ON profiles(qualification_status);
CREATE INDEX IF NOT EXISTS idx_profiles_background_check_status ON profiles(background_check_status);
CREATE INDEX IF NOT EXISTS idx_profiles_background_check_expires_at ON profiles(background_check_expires_at);
CREATE INDEX IF NOT EXISTS idx_profiles_compliance_pending
  ON profiles(user_type, qualification_status, background_check_status)
  WHERE user_type = 'coach';

COMMIT;
