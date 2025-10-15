-- Add Row Level Security policies for coach availability tables
-- Migration: 20251016_add_rls_for_availability.sql
-- Created: October 15, 2025

-- Enable RLS on new tables
ALTER TABLE coach_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_recurring_availability ENABLE ROW LEVEL SECURITY;

-- COACH AVAILABILITY POLICIES
-- Anyone can view coach availability (public information for booking)
CREATE POLICY "coach_availability_select" ON coach_availability
  FOR SELECT
  TO public
  USING (true);

-- Only the coach themselves or admin can add their availability
CREATE POLICY "coach_availability_insert" ON coach_availability
  FOR INSERT
  TO public
  WITH CHECK (
    coach_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- Only the coach themselves or admin can update their availability
CREATE POLICY "coach_availability_update" ON coach_availability
  FOR UPDATE
  TO public
  USING (
    coach_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  )
  WITH CHECK (
    coach_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- Only the coach themselves or admin can delete their availability
CREATE POLICY "coach_availability_delete" ON coach_availability
  FOR DELETE
  TO public
  USING (
    coach_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- COACH RECURRING AVAILABILITY POLICIES
-- Anyone can view recurring availability (public information)
CREATE POLICY "coach_recurring_select" ON coach_recurring_availability
  FOR SELECT
  TO public
  USING (true);

-- Only the coach themselves or admin can add recurring availability
CREATE POLICY "coach_recurring_insert" ON coach_recurring_availability
  FOR INSERT
  TO public
  WITH CHECK (
    coach_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- Only the coach themselves or admin can update recurring availability
CREATE POLICY "coach_recurring_update" ON coach_recurring_availability
  FOR UPDATE
  TO public
  USING (
    coach_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  )
  WITH CHECK (
    coach_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- Only the coach themselves or admin can delete recurring availability
CREATE POLICY "coach_recurring_delete" ON coach_recurring_availability
  FOR DELETE
  TO public
  USING (
    coach_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- Verify RLS is enabled
DO $$
BEGIN
  RAISE NOTICE 'RLS Status Check:';
  RAISE NOTICE '- coach_availability: %', (SELECT relrowsecurity FROM pg_class WHERE relname = 'coach_availability');
  RAISE NOTICE '- coach_recurring_availability: %', (SELECT relrowsecurity FROM pg_class WHERE relname = 'coach_recurring_availability');
END $$;
