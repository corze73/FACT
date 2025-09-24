-- Session Management Schema Updates
-- Run this migration to add session tracking and payment management

-- Add session tracking columns to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_arrived_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS coach_arrived_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_completed_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS coach_completed_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS session_completed_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS early_completion_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_held_until TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dispute_status VARCHAR(50);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dispute_deadline TIMESTAMPTZ;

-- Add payment tracking table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'pending', -- pending, held, released, refunded, disputed
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255),
    admin_fee DECIMAL(10,2) DEFAULT 0,
    refund_amount DECIMAL(10,2) DEFAULT 0,
    refund_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    released_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ
);

-- Add session disputes table
CREATE TABLE IF NOT EXISTS session_disputes (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
    initiated_by INTEGER REFERENCES users(id),
    dispute_reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'open', -- open, coach_responded, resolved, auto_resolved
    created_at TIMESTAMPTZ DEFAULT NOW(),
    coach_response TEXT,
    coach_responded_at TIMESTAMPTZ,
    resolution VARCHAR(50), -- refund_client, pay_coach, split_payment
    resolved_at TIMESTAMPTZ
);

-- Update reviews table to support mutual reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewer_type VARCHAR(20); -- 'client' or 'coach'
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT FALSE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_session_dates ON bookings(session_started_at, session_completed_at);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON session_disputes(status);

-- Add RLS policies for new tables
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_disputes ENABLE ROW LEVEL SECURITY;

-- Payments policies
CREATE POLICY IF NOT EXISTS "Users can view their own payments" ON payments
    FOR SELECT USING (
        booking_id IN (
            SELECT id FROM bookings WHERE client_id = current_user_id() OR coach_id = current_user_id()
        )
    );

CREATE POLICY IF NOT EXISTS "Admins can view all payments" ON payments
    FOR ALL USING (is_admin());

-- Disputes policies  
CREATE POLICY IF NOT EXISTS "Users can view their booking disputes" ON session_disputes
    FOR SELECT USING (
        booking_id IN (
            SELECT id FROM bookings WHERE client_id = current_user_id() OR coach_id = current_user_id()
        )
    );

CREATE POLICY IF NOT EXISTS "Users can create disputes for their bookings" ON session_disputes
    FOR INSERT WITH CHECK (
        booking_id IN (
            SELECT id FROM bookings WHERE client_id = current_user_id() OR coach_id = current_user_id()
        ) AND
        initiated_by = current_user_id()
    );

CREATE POLICY IF NOT EXISTS "Admins can manage all disputes" ON session_disputes
    FOR ALL USING (is_admin());

-- Add booking status updates
-- Update existing booking statuses to include session states
-- New statuses: confirmed, client_arrived, coach_arrived, in_session, completed, disputed