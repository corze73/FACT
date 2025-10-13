-- Migration: Add authentication logging and email notification tables
-- File: 20251013_add_auth_logging_and_email_tables.sql

-- Create auth_logs table to track authentication events
CREATE TABLE IF NOT EXISTS auth_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('signup', 'signin', 'signout', 'password_reset', 'email_verification')),
    user_email VARCHAR(255) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT false,
    error_details TEXT NULL,
    user_agent TEXT NULL,
    ip_address INET NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_auth_logs_user_email ON auth_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_auth_logs_timestamp ON auth_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_auth_logs_success ON auth_logs(success);
CREATE INDEX IF NOT EXISTS idx_auth_logs_event_type ON auth_logs(event_type);

-- Create email_logs table to track email notifications
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
    sent_at TIMESTAMPTZ NULL,
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for email_logs
CREATE INDEX IF NOT EXISTS idx_email_logs_to_email ON email_logs(to_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);

-- Create admin_notifications table for admin dashboard alerts
CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(100) NOT NULL CHECK (type IN ('auth_failure', 'signup_failure', 'system_error', 'security_alert')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    related_user_email VARCHAR(255) NULL,
    metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for admin_notifications
CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON admin_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_severity ON admin_notifications(severity);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(type);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at);

-- Add update trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to tables that need it
DROP TRIGGER IF EXISTS update_email_logs_updated_at ON email_logs;
CREATE TRIGGER update_email_logs_updated_at 
    BEFORE UPDATE ON email_logs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_admin_notifications_updated_at ON admin_notifications;
CREATE TRIGGER update_admin_notifications_updated_at 
    BEFORE UPDATE ON admin_notifications 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample admin notification types for reference
INSERT INTO admin_notifications (type, title, message, severity, metadata) VALUES 
('system_error', 'Database Migration Completed', 'Authentication logging and email notification tables have been successfully created.', 'info', '{"migration": "20251013_add_auth_logging_and_email_tables", "tables_created": ["auth_logs", "email_logs", "admin_notifications"]}')
ON CONFLICT DO NOTHING;

-- Grant appropriate permissions (adjust based on your RLS policies)
-- These are examples - adjust based on your specific security requirements

-- Allow authenticated users to insert their own auth logs
-- CREATE POLICY IF NOT EXISTS "Users can insert own auth logs" ON auth_logs
--     FOR INSERT TO authenticated
--     WITH CHECK (user_email = current_setting('app.current_user_email', true));

-- Allow admins to read all logs
-- CREATE POLICY IF NOT EXISTS "Admins can read all auth logs" ON auth_logs
--     FOR SELECT TO authenticated
--     USING (
--         EXISTS (
--             SELECT 1 FROM profiles 
--             WHERE profiles.id::text = current_setting('app.current_user_id', true)
--             AND profiles.role = 'admin'
--         )
--     );

-- Comments for documentation
COMMENT ON TABLE auth_logs IS 'Tracks all authentication events (signup, signin, failures) for security monitoring';
COMMENT ON TABLE email_logs IS 'Logs all email notifications sent by the system for delivery tracking';
COMMENT ON TABLE admin_notifications IS 'Stores notifications for admin dashboard alerts and system monitoring';

COMMENT ON COLUMN auth_logs.event_type IS 'Type of authentication event: signup, signin, signout, password_reset, email_verification';
COMMENT ON COLUMN auth_logs.success IS 'Whether the authentication event was successful';
COMMENT ON COLUMN auth_logs.error_details IS 'JSON string containing error details for failed events';
COMMENT ON COLUMN auth_logs.user_agent IS 'Browser/client user agent string for security tracking';
COMMENT ON COLUMN auth_logs.ip_address IS 'IP address of the authentication attempt (when available)';

COMMENT ON COLUMN email_logs.status IS 'Email delivery status: pending, sent, failed, bounced';
COMMENT ON COLUMN email_logs.html_content IS 'HTML version of the email content';
COMMENT ON COLUMN email_logs.text_content IS 'Plain text version of the email content (optional)';

COMMENT ON COLUMN admin_notifications.type IS 'Category of notification for filtering and routing';
COMMENT ON COLUMN admin_notifications.severity IS 'Importance level: info, warning, error, critical';
COMMENT ON COLUMN admin_notifications.metadata IS 'Additional structured data related to the notification';