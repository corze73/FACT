BEGIN;

CREATE TABLE IF NOT EXISTS profile_location_backfill_audit (
  profile_id uuid PRIMARY KEY,
  migration_tag text NOT NULL,
  location_raw text,
  parsed_city text,
  parsed_country text,
  parsed_success boolean NOT NULL,
  audited_at timestamptz NOT NULL DEFAULT NOW()
);

INSERT INTO profile_location_backfill_audit (
  profile_id,
  migration_tag,
  location_raw,
  parsed_city,
  parsed_country,
  parsed_success
)
SELECT
  p.id,
  '20260221_backfill_country_city_from_location',
  p.location,
  CASE
    WHEN p.location ~ '^\\s*[^,]+\\s*,\\s*[^,]+\\s*$' THEN NULLIF(TRIM(split_part(p.location, ',', 1)), '')
    ELSE NULL
  END,
  CASE
    WHEN p.location ~ '^\\s*[^,]+\\s*,\\s*[^,]+\\s*$' THEN NULLIF(TRIM(split_part(p.location, ',', 2)), '')
    ELSE NULL
  END,
  (p.location ~ '^\\s*[^,]+\\s*,\\s*[^,]+\\s*$')
FROM profiles p
WHERE (NULLIF(TRIM(COALESCE(p.country, '')), '') IS NULL OR NULLIF(TRIM(COALESCE(p.city, '')), '') IS NULL)
  AND NULLIF(TRIM(COALESCE(p.location, '')), '') IS NOT NULL
ON CONFLICT (profile_id) DO NOTHING;

UPDATE profiles p
SET
  city = COALESCE(NULLIF(TRIM(p.city), ''), a.parsed_city),
  country = COALESCE(NULLIF(TRIM(p.country), ''), a.parsed_country),
  updated_at = NOW()
FROM profile_location_backfill_audit a
WHERE a.profile_id = p.id
  AND a.migration_tag = '20260221_backfill_country_city_from_location'
  AND a.parsed_success = true
  AND (
    NULLIF(TRIM(COALESCE(p.country, '')), '') IS NULL
    OR NULLIF(TRIM(COALESCE(p.city, '')), '') IS NULL
  );

CREATE INDEX IF NOT EXISTS idx_profiles_country ON profiles(country);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_country_city ON profiles(country, city);

COMMIT;

-- Notes:
-- - Strict parsing only for "City, Country" values to avoid incorrect guesses.
-- - Rows without parseable location remain NULL and should be updated by user profile edits.