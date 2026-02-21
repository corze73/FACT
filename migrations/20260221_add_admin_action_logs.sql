-- Phase 4: Stability/Compliance hardening
-- Audit table for destructive admin actions

CREATE TABLE IF NOT EXISTS admin_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_actor ON admin_action_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_target ON admin_action_logs(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_action ON admin_action_logs(action);
