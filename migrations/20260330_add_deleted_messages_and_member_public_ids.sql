-- Adds durable deleted message archiving and immutable member public IDs.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS member_public_id TEXT;

CREATE OR REPLACE FUNCTION member_public_id_prefix(p_user_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE LOWER(COALESCE(p_user_type, 'client'))
    WHEN 'coach' THEN 'CO'
    WHEN 'admin' THEN 'AD'
    ELSE 'CL'
  END;
$$;

CREATE OR REPLACE FUNCTION generate_member_public_id(p_user_type TEXT DEFAULT 'client')
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  candidate TEXT;
  prefix TEXT := member_public_id_prefix(p_user_type);
BEGIN
  LOOP
    candidate := format(
      'FACT-%s-%s',
      prefix,
      SUBSTRING(UPPER(MD5(gen_random_uuid()::TEXT || clock_timestamp()::TEXT || COALESCE(p_user_type, 'client'))) FROM 1 FOR 8)
    );

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM profiles WHERE member_public_id = candidate
    );
  END LOOP;

  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION assign_member_public_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NULLIF(TRIM(COALESCE(NEW.member_public_id, '')), '') IS NULL THEN
    NEW.member_public_id := generate_member_public_id(NEW.user_type);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_assign_member_public_id ON profiles;
CREATE TRIGGER trg_profiles_assign_member_public_id
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION assign_member_public_id();

UPDATE profiles
SET member_public_id = generate_member_public_id(user_type)
WHERE NULLIF(TRIM(COALESCE(member_public_id, '')), '') IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_member_public_id
  ON profiles(member_public_id);

CREATE TABLE IF NOT EXISTS deleted_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_message_id UUID,
  booking_id UUID REFERENCES bookings(id),
  sender_id UUID REFERENCES profiles(id),
  receiver_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_date TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT false,
  deleted_by_user_id UUID REFERENCES profiles(id),
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deletion_scope TEXT NOT NULL DEFAULT 'single' CHECK (deletion_scope IN ('single', 'conversation_clear')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_deleted_messages_original_message_id
  ON deleted_messages(original_message_id);
CREATE INDEX IF NOT EXISTS idx_deleted_messages_deleted_at
  ON deleted_messages(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_deleted_messages_booking_id
  ON deleted_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_deleted_messages_deleted_by_user_id
  ON deleted_messages(deleted_by_user_id);

COMMENT ON COLUMN profiles.member_public_id IS 'Immutable public member identifier shown to admins and users';
COMMENT ON TABLE deleted_messages IS 'Archive of deleted or cleared messages retained for admin review and audit';
