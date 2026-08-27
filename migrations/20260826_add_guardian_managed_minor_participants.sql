-- Guardian-managed child participants and adult account age assurance.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS minor_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) BETWEEN 2 AND 100),
  date_of_birth DATE NOT NULL,
  relationship_to_guardian TEXT NOT NULL CHECK (
    relationship_to_guardian IN ('parent', 'legal_guardian')
  ),
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  medical_or_access_notes TEXT,
  guardian_consent_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (date_of_birth > CURRENT_DATE - INTERVAL '18 years'),
  CHECK (date_of_birth <= CURRENT_DATE)
);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS minor_participant_id UUID REFERENCES minor_participants(id),
  ADD COLUMN IF NOT EXISTS guardian_attendance_confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_minor_participants_guardian
  ON minor_participants(guardian_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bookings_minor_participant
  ON bookings(minor_participant_id) WHERE minor_participant_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_minor_participants_updated_at ON minor_participants;
CREATE TRIGGER update_minor_participants_updated_at
  BEFORE UPDATE ON minor_participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE minor_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guardian_manage_minor_participants ON minor_participants;
CREATE POLICY guardian_manage_minor_participants ON minor_participants
  FOR ALL
  USING (guardian_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (guardian_id::text = current_setting('app.current_user_id', true));
