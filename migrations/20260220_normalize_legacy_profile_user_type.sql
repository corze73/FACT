BEGIN;

CREATE TABLE IF NOT EXISTS user_type_normalization_audit (
  migration_tag text NOT NULL,
  profile_id uuid PRIMARY KEY,
  previous_user_type text NOT NULL,
  normalized_user_type text NOT NULL,
  normalized_at timestamptz NOT NULL DEFAULT NOW()
);

INSERT INTO user_type_normalization_audit (
  migration_tag,
  profile_id,
  previous_user_type,
  normalized_user_type
)
SELECT
  '20260220_normalize_legacy_profile_user_type',
  p.id,
  p.user_type,
  'client'
FROM profiles p
WHERE p.user_type = 'user'
ON CONFLICT (profile_id) DO NOTHING;

UPDATE profiles p
SET
  user_type = 'client',
  updated_at = NOW()
WHERE p.id IN (
  SELECT a.profile_id
  FROM user_type_normalization_audit a
  WHERE a.migration_tag = '20260220_normalize_legacy_profile_user_type'
    AND a.previous_user_type = 'user'
)
  AND p.user_type = 'user';

COMMIT;

-- Rollback (if needed):
-- BEGIN;
-- UPDATE profiles p
-- SET user_type = a.previous_user_type,
--     updated_at = NOW()
-- FROM user_type_normalization_audit a
-- WHERE a.migration_tag = '20260220_normalize_legacy_profile_user_type'
--   AND a.profile_id = p.id;
-- COMMIT;
