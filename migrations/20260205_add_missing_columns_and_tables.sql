-- Migration: Add missing database columns and tables
-- Date: 2026-02-05
-- Description: Adds video clips, location fields, payment status, and payments table

-- ===========================================
-- PROFILES TABLE UPDATES
-- ===========================================

-- Add video clip URLs for coaches
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS video_clip_1 TEXT,
ADD COLUMN IF NOT EXISTS video_clip_2 TEXT,
ADD COLUMN IF NOT EXISTS video_clip_3 TEXT;

-- Add structured location fields
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS postcode TEXT;

-- Add indexes for location searches
CREATE INDEX IF NOT EXISTS idx_profiles_country ON profiles(country);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_country_city ON profiles(country, city);

-- ===========================================
-- BOOKINGS TABLE UPDATES
-- ===========================================

-- Add payment tracking fields
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS payment_status TEXT CHECK (payment_status IN ('pending', 'authorized', 'captured', 'released', 'refunded', 'failed')) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS service_price DECIMAL(10,2);

-- Add index for payment status queries
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);

-- ===========================================
-- PAYMENTS TABLE (Stripe Integration)
-- ===========================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'gbp',
    status TEXT CHECK (status IN ('pending', 'authorized', 'captured', 'released', 'refunded', 'failed')) DEFAULT 'pending',
    payment_method TEXT DEFAULT 'stripe',
    transaction_id TEXT UNIQUE, -- Stripe PaymentIntent ID
    admin_fee DECIMAL(10,2) DEFAULT 0,
    coach_amount DECIMAL(10,2), -- Amount for coach after admin fee
    refund_amount DECIMAL(10,2) DEFAULT 0,
    refund_reason TEXT,
    released_at TIMESTAMPTZ, -- When payment released to coach
    refunded_at TIMESTAMPTZ, -- When refund processed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- Update trigger for payments
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- PERFORMANCE INDEXES
-- ===========================================

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_bookings_coach_status ON bookings(coach_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_client_status ON bookings(client_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_date_status ON bookings(booking_date DESC, status);
CREATE INDEX IF NOT EXISTS idx_profiles_type_active ON profiles(user_type, is_active);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(receiver_id, is_read) WHERE is_read = false;

-- Partial index for active profiles
CREATE INDEX IF NOT EXISTS idx_profiles_active_coaches ON profiles(user_type, country, city) 
WHERE user_type = 'coach' AND is_active = true;

-- ===========================================
-- RLS POLICIES FOR PAYMENTS TABLE
-- ===========================================

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Anyone can view their own payment records (as client)
CREATE POLICY "payments_select_own" ON payments
  FOR SELECT
  TO public
  USING (
    booking_id IN (
      SELECT id FROM bookings 
      WHERE client_id = current_setting('app.current_user_id', true)::uuid 
         OR coach_id = current_setting('app.current_user_id', true)::uuid
    )
    OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- Only system/admin can insert payments
CREATE POLICY "payments_insert_admin" ON payments
  FOR INSERT
  TO public
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- Only admin can update payments
CREATE POLICY "payments_update_admin" ON payments
  FOR UPDATE
  TO public
  USING (
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- Comments for documentation
COMMENT ON COLUMN profiles.video_clip_1 IS 'First video showcase URL (YouTube, Vimeo, etc.)';
COMMENT ON COLUMN profiles.video_clip_2 IS 'Second video showcase URL';
COMMENT ON COLUMN profiles.video_clip_3 IS 'Third video showcase URL';
COMMENT ON COLUMN profiles.country IS 'Country for structured location searches';
COMMENT ON COLUMN profiles.city IS 'City for structured location searches';
COMMENT ON COLUMN profiles.postcode IS 'Postal/ZIP code';
COMMENT ON COLUMN bookings.payment_status IS 'Current payment status for this booking';
COMMENT ON COLUMN bookings.service_price IS 'Coach service price (before admin fee)';
COMMENT ON TABLE payments IS 'Payment transaction records for Stripe integration';

-- Verification query
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed successfully';
  RAISE NOTICE 'Added columns: video_clip_1-3, country, city, postcode, payment_status, service_price';
  RAISE NOTICE 'Created table: payments';
  RAISE NOTICE 'Added %s performance indexes', (
    SELECT count(*) FROM pg_indexes 
    WHERE tablename IN ('profiles', 'bookings', 'payments', 'messages')
    AND indexname LIKE 'idx_%'
  );
END $$;
