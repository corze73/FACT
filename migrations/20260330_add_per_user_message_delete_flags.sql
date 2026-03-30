-- Per-user message deletion flags so deleting a message only hides it for the acting user.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS deleted_by_sender_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_receiver_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_deleted_by_sender_at
  ON messages(deleted_by_sender_at);

CREATE INDEX IF NOT EXISTS idx_messages_deleted_by_receiver_at
  ON messages(deleted_by_receiver_at);

COMMENT ON COLUMN messages.deleted_by_sender_at IS 'Timestamp when sender deleted the message from their own inbox';
COMMENT ON COLUMN messages.deleted_by_receiver_at IS 'Timestamp when receiver deleted the message from their own inbox';
