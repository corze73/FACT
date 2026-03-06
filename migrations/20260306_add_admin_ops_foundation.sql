BEGIN;

-- Admin permission scope + auth token revocation support
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS admin_scope TEXT NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS token_revoked_at TIMESTAMPTZ NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_admin_scope_check'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_admin_scope_check
      CHECK (admin_scope IN ('full', 'support', 'compliance', 'ops', 'read_only'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_admin_scope
  ON profiles(user_type, admin_scope)
  WHERE user_type = 'admin';

CREATE INDEX IF NOT EXISTS idx_profiles_token_revoked_at
  ON profiles(token_revoked_at)
  WHERE token_revoked_at IS NOT NULL;

-- Internal admin case management
CREATE TABLE IF NOT EXISTS admin_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  category TEXT NOT NULL DEFAULT 'general',
  owner_admin_id UUID NULL,
  target_user_id UUID NULL,
  booking_id UUID NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ NULL,
  CONSTRAINT admin_cases_status_check CHECK (status IN ('open', 'in_progress', 'blocked', 'resolved', 'closed')),
  CONSTRAINT admin_cases_priority_check CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  CONSTRAINT admin_cases_owner_fkey FOREIGN KEY (owner_admin_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT admin_cases_target_user_fkey FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT admin_cases_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_admin_cases_status ON admin_cases(status, priority, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_cases_owner ON admin_cases(owner_admin_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_cases_target ON admin_cases(target_user_id, updated_at DESC);

-- Booking disputes / refund workflow tracker
CREATE TABLE IF NOT EXISTS booking_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NULL,
  opened_by UUID NOT NULL,
  assigned_admin_id UUID NULL,
  status TEXT NOT NULL DEFAULT 'open',
  decision TEXT NULL,
  refund_amount NUMERIC(10,2) NULL,
  reason TEXT NOT NULL,
  resolution_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ NULL,
  CONSTRAINT booking_disputes_status_check CHECK (status IN ('open', 'under_review', 'resolved', 'closed')),
  CONSTRAINT booking_disputes_decision_check CHECK (decision IS NULL OR decision IN ('refund_full', 'refund_partial', 'no_refund', 'other')),
  CONSTRAINT booking_disputes_opened_by_fkey FOREIGN KEY (opened_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT booking_disputes_assigned_admin_fkey FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_booking_disputes_status ON booking_disputes(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_disputes_assigned_admin ON booking_disputes(assigned_admin_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_disputes_booking_id ON booking_disputes(booking_id);

-- Pre-delete snapshots for irreversible user hard-delete actions
CREATE TABLE IF NOT EXISTS deleted_user_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  deleted_by UUID NOT NULL,
  approved_by UUID NULL,
  reason TEXT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT deleted_user_snapshots_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT deleted_user_snapshots_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deleted_user_snapshots_user_id ON deleted_user_snapshots(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deleted_user_snapshots_deleted_by ON deleted_user_snapshots(deleted_by, created_at DESC);

-- Record export actions for PII access/auditability
CREATE TABLE IF NOT EXISTS admin_export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL,
  export_type TEXT NOT NULL,
  redaction_level TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_export_logs_actor_fkey FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT admin_export_logs_redaction_check CHECK (redaction_level IN ('full', 'masked', 'strict'))
);

CREATE INDEX IF NOT EXISTS idx_admin_export_logs_actor ON admin_export_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_export_logs_type ON admin_export_logs(export_type, created_at DESC);

COMMIT;
