-- Add missing service_type column to bookings table
-- This column tracks the type of coaching service being booked

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS service_type TEXT;

-- Add some constraints to ensure data quality
ALTER TABLE bookings 
ADD CONSTRAINT check_service_type 
CHECK (service_type IN ('technical_skills', 'fitness_training', 'mental_coaching', 'tactical_analysis', 'match_preparation', 'injury_recovery', 'youth_development', 'goalkeeping', 'other'));