-- Table to track end-user account deletion requests awaiting admin decision
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES profiles(id),
  decision_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_adr_user_id ON account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_adr_status ON account_deletion_requests(status);
