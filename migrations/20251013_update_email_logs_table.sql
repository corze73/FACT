-- Add additional columns to email_logs table for better tracking
-- Migration: Add message_id, error_message, and updated_at columns

ALTER TABLE email_logs 
ADD COLUMN IF NOT EXISTS message_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update existing records to have updated_at
UPDATE email_logs 
SET updated_at = created_at 
WHERE updated_at IS NULL;