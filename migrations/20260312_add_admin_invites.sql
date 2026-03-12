CREATE TABLE IF NOT EXISTS admin_invites (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  admin_scope text NOT NULL DEFAULT 'support',
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_invites_admin_scope_check CHECK (admin_scope IN ('full', 'support', 'compliance', 'ops', 'read_only')),
  CONSTRAINT admin_invites_status_check CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_invites_pending_email
  ON admin_invites (lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_admin_invites_expires_at
  ON admin_invites (expires_at);

CREATE INDEX IF NOT EXISTS idx_admin_invites_invited_by
  ON admin_invites (invited_by);

CREATE INDEX IF NOT EXISTS idx_admin_invites_status
  ON admin_invites (status);
