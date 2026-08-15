-- Prevent duplicate transactional emails when payment webhooks are retried.
ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS event_key VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_logs_event_key_unique
  ON email_logs(event_key)
  WHERE event_key IS NOT NULL;

COMMENT ON COLUMN email_logs.event_key IS
  'Stable booking-event-recipient key used to prevent duplicate transactional email sends';
