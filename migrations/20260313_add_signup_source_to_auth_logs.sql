-- Migration: add signup source attribution to auth logs
-- Values will indicate where signup came from (email, oauth, invite, unknown)

ALTER TABLE auth_logs
  ADD COLUMN IF NOT EXISTS signup_source text;

CREATE INDEX IF NOT EXISTS idx_auth_logs_signup_source
  ON auth_logs(signup_source)
  WHERE signup_source IS NOT NULL;
