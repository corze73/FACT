-- Migration tracking table
-- This allows us to track which migrations have been applied
-- Created: December 19, 2025

CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    checksum VARCHAR(64),
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT
);

-- Index for quick version lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at DESC);

-- Insert record for this migration
INSERT INTO schema_migrations (version, name, execution_time_ms, success)
VALUES ('20251219', 'create_schema_migrations', 0, true)
ON CONFLICT (version) DO NOTHING;

-- Optionally, record all existing migrations that have already been applied
-- This assumes you've already applied these migrations manually
INSERT INTO schema_migrations (version, name, applied_at, success) VALUES
    ('20251013', 'add_auth_logging_and_email_tables', NOW(), true),
    ('20251013b', 'update_email_logs_table', NOW(), true),
    ('20251014', 'add_media_fields', NOW(), true),
    ('20251015', 'add_reschedule_and_availability', NOW(), true),
    ('20251016', 'add_rls_for_availability', NOW(), true),
    ('20251016b', 'add_user_deactivation_fields', NOW(), true),
    ('20251016c', 'create_account_deletion_requests', NOW(), true),
    ('20251218', 'add_booking_archiving', NOW(), true)
ON CONFLICT (version) DO NOTHING;

COMMENT ON TABLE schema_migrations IS 'Tracks database migration history';
COMMENT ON COLUMN schema_migrations.version IS 'Migration version identifier (typically YYYYMMDD format)';
COMMENT ON COLUMN schema_migrations.checksum IS 'Optional: MD5/SHA hash of migration file for integrity checking';
