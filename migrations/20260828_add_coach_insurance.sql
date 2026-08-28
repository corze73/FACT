BEGIN;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS insurance_provider TEXT,
  ADD COLUMN IF NOT EXISTS insurance_policy_number TEXT,
  ADD COLUMN IF NOT EXISTS insurance_cover_amount_gbp NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS insurance_file_url TEXT,
  ADD COLUMN IF NOT EXISTS insurance_status TEXT NOT NULL DEFAULT 'incomplete',
  ADD COLUMN IF NOT EXISTS insurance_starts_at DATE,
  ADD COLUMN IF NOT EXISTS insurance_expires_at DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_insurance_status_check'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_insurance_status_check
      CHECK (insurance_status IN ('incomplete', 'pending', 'verified', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_insurance_cover_nonnegative_check'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_insurance_cover_nonnegative_check
      CHECK (insurance_cover_amount_gbp IS NULL OR insurance_cover_amount_gbp >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_insurance_status ON profiles(insurance_status);
CREATE INDEX IF NOT EXISTS idx_profiles_insurance_expires_at ON profiles(insurance_expires_at);

COMMIT;
