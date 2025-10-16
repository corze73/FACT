-- Add soft-delete fields to profiles for admin removals with reason
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

-- Helpful for filtering active users
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
