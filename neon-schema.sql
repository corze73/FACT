-- This recreates the Supabase structure in Neon

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_public_id TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    user_type TEXT CHECK (user_type IN ('user', 'coach', 'admin')) DEFAULT 'user',
    location TEXT,
    skills TEXT[],
    bio TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    phone TEXT,
    role TEXT CHECK (role IN ('user', 'admin')) DEFAULT 'user',
    preferred_coaching_types TEXT[],
    preferred_session_times TEXT[],
    coach_profile JSONB,
    metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS minor_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guardian_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    relationship_to_guardian TEXT NOT NULL CHECK (relationship_to_guardian IN ('parent', 'legal_guardian')),
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    medical_or_access_notes TEXT,
    guardian_consent_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    client_id UUID REFERENCES profiles(id),
    coach_id UUID REFERENCES profiles(id),
    status TEXT CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')) DEFAULT 'pending',
    booking_date TIMESTAMPTZ NOT NULL,
    duration INTEGER NOT NULL, -- in minutes
    service_type TEXT, -- type of coaching service
    location TEXT, -- legacy location field
    location_type TEXT DEFAULT 'online', -- online/in-person
    location_address TEXT, -- address for in-person sessions
    location_notes TEXT, -- additional location info
    notes TEXT, -- legacy notes field
    client_notes TEXT, -- user's special requests
    price DECIMAL(10,2),
    admin_fee DECIMAL(10,2) DEFAULT 3.00,
    total_price DECIMAL(10,2),
    session_completed_by_user BOOLEAN DEFAULT false,
    session_completed_by_coach BOOLEAN DEFAULT false,
    minor_participant_id UUID REFERENCES minor_participants(id),
    guardian_attendance_confirmed_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table (note: using created_date instead of created_at based on the export error)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES profiles(id),
    receiver_id UUID REFERENCES profiles(id),
    booking_id UUID REFERENCES bookings(id),
    content TEXT NOT NULL,
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_read BOOLEAN DEFAULT false,
    deleted_by_sender_at TIMESTAMPTZ,
    deleted_by_receiver_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS deleted_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_message_id UUID,
    sender_id UUID REFERENCES profiles(id),
    receiver_id UUID REFERENCES profiles(id),
    booking_id UUID REFERENCES bookings(id),
    content TEXT NOT NULL,
    created_date TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    is_read BOOLEAN DEFAULT false,
    deleted_by_user_id UUID REFERENCES profiles(id),
    deleted_at TIMESTAMPTZ DEFAULT NOW(),
    deletion_scope TEXT DEFAULT 'single',
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id),
    reviewer_id UUID REFERENCES profiles(id),
    reviewee_id UUID REFERENCES profiles(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_member_public_id ON profiles(member_public_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_coach_id ON bookings(coach_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_deleted_by_sender_at ON messages(deleted_by_sender_at);
CREATE INDEX IF NOT EXISTS idx_messages_deleted_by_receiver_at ON messages(deleted_by_receiver_at);
CREATE INDEX IF NOT EXISTS idx_deleted_messages_original_message_id ON deleted_messages(original_message_id);
CREATE INDEX IF NOT EXISTS idx_deleted_messages_deleted_at ON deleted_messages(deleted_at);
CREATE INDEX IF NOT EXISTS idx_reviews_booking_id ON reviews(booking_id);

-- Add update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
