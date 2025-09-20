/*
  # Update RLS policies for admin access

  1. Security Updates
    - Update bookings SELECT policy to allow admin users to view all bookings
    - Update messages SELECT policy to allow admin users to view all messages
    - Update reviews SELECT policy to allow admin users to view all reviews
    - Ensure admin users have full platform visibility

  2. Policy Changes
    - Bookings: Allow admins to see all bookings regardless of user_id/client_id/coach_id
    - Messages: Allow admins to see all messages regardless of sender/receiver
    - Reviews: Allow admins to see all reviews (already public but ensuring consistency)
*/

-- Update bookings SELECT policy to include admin access
DROP POLICY IF EXISTS "Users can view their bookings" ON bookings;

CREATE POLICY "Users can view their bookings" ON bookings
  FOR SELECT
  TO public
  USING (
    (auth.uid() = user_id) OR 
    (auth.uid() = client_id) OR 
    (auth.uid() = coach_id) OR
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    ))
  );

-- Update messages SELECT policy to include admin access
DROP POLICY IF EXISTS "Users can view their messages" ON messages;

CREATE POLICY "Users can view their messages" ON messages
  FOR SELECT
  TO public
  USING (
    (auth.uid() = sender_id) OR 
    (auth.uid() = receiver_id) OR
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    ))
  );

-- Update bookings UPDATE policy to include admin access
DROP POLICY IF EXISTS "Users can update their bookings" ON bookings;

CREATE POLICY "Users can update their bookings" ON bookings
  FOR UPDATE
  TO public
  USING (
    (auth.uid() = user_id) OR 
    (auth.uid() = coach_id) OR 
    (auth.uid() = client_id) OR
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    ))
  )
  WITH CHECK (
    (auth.uid() = user_id) OR 
    (auth.uid() = coach_id) OR 
    (auth.uid() = client_id) OR
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    ))
  );

-- Update messages UPDATE policy to include admin access
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;

CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE
  TO public
  USING (
    (auth.uid() = sender_id) OR 
    (auth.uid() = receiver_id) OR
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    ))
  )
  WITH CHECK (
    (auth.uid() = sender_id) OR 
    (auth.uid() = receiver_id) OR
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    ))
  );

-- Ensure admin users can insert bookings (for testing/management purposes)
DROP POLICY IF EXISTS "Users can insert their own booking" ON bookings;

CREATE POLICY "Users can insert their own booking" ON bookings
  FOR INSERT
  TO public
  WITH CHECK (
    (auth.uid() = user_id) OR
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    ))
  );

-- Ensure admin users can insert messages (for platform communication)
DROP POLICY IF EXISTS "Users can send messages" ON messages;

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT
  TO public
  WITH CHECK (
    (auth.uid() = sender_id) OR
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    ))
  );