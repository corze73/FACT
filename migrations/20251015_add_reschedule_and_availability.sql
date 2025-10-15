-- Add reschedule functionality to bookings table
-- Allows users/coaches to suggest new times for existing bookings

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS reschedule_requested_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS reschedule_proposed_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reschedule_status TEXT CHECK (reschedule_status IN ('none', 'pending', 'accepted', 'declined')) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS reschedule_requested_at TIMESTAMPTZ;

-- Add coach availability table
-- Stores coach availability windows and temporary location changes
CREATE TABLE IF NOT EXISTS coach_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID REFERENCES profiles(id) NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_available BOOLEAN DEFAULT true,
    location_override TEXT, -- Temporary location (e.g., when traveling)
    notes TEXT, -- Additional notes about availability
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add recurring availability patterns (for regular weekly schedule)
CREATE TABLE IF NOT EXISTS coach_recurring_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID REFERENCES profiles(id) NOT NULL,
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_reschedule_status ON bookings(reschedule_status);
CREATE INDEX IF NOT EXISTS idx_coach_availability_coach_id ON coach_availability(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_availability_dates ON coach_availability(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_coach_recurring_coach_id ON coach_recurring_availability(coach_id);

-- Add update trigger for coach_availability
CREATE TRIGGER update_coach_availability_updated_at BEFORE UPDATE ON coach_availability
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coach_recurring_availability_updated_at BEFORE UPDATE ON coach_recurring_availability
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON COLUMN bookings.reschedule_requested_by IS 'User ID who requested the reschedule';
COMMENT ON COLUMN bookings.reschedule_proposed_date IS 'Proposed new date/time for the booking';
COMMENT ON COLUMN bookings.reschedule_status IS 'Status of reschedule request: none, pending, accepted, declined';
COMMENT ON TABLE coach_availability IS 'Coach availability windows and temporary location overrides';
COMMENT ON TABLE coach_recurring_availability IS 'Regular weekly availability patterns for coaches';
