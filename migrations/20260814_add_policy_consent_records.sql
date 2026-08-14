BEGIN;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS terms_version TEXT NULL,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS privacy_version TEXT NULL,
  ADD COLUMN IF NOT EXISTS privacy_acknowledged_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS adult_account_confirmed_at TIMESTAMPTZ NULL;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS policy_version TEXT NULL,
  ADD COLUMN IF NOT EXISTS cancellation_policy_accepted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_terms_version ON profiles(terms_version);
CREATE INDEX IF NOT EXISTS idx_bookings_policy_version ON bookings(policy_version);

COMMIT;
