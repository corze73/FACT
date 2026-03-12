-- Migration: Add password-based authentication fields to users table
-- Run this in the Neon SQL editor

-- Add password_hash column for storing scrypt-hashed passwords
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Add columns for password reset flow
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;

-- Index to quickly look up reset tokens
CREATE INDEX IF NOT EXISTS idx_users_reset_token_hash
  ON users(password_reset_token_hash)
  WHERE password_reset_token_hash IS NOT NULL;
