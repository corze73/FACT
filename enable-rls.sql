-- Enable RLS and create security policies for Neon database
-- Note: These policies are adapted from Supabase auth.uid() to work with current auth system

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY; 
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- PROFILES TABLE POLICIES
-- Allow users to view their own profile and admins to view all
CREATE POLICY "profiles_select_policy" ON profiles
  FOR SELECT
  TO public
  USING (
    id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- Allow users to update their own profile and admins to update any
CREATE POLICY "profiles_update_policy" ON profiles
  FOR UPDATE
  TO public
  USING (
    id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  )
  WITH CHECK (
    id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- Allow new user registration and admin inserts
CREATE POLICY "profiles_insert_policy" ON profiles
  FOR INSERT
  TO public
  WITH CHECK (
    id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- BOOKINGS TABLE POLICIES
-- Allow users to view their bookings (as client, coach, or user) and admins to view all
CREATE POLICY "bookings_select_policy" ON bookings
  FOR SELECT
  TO public
  USING (
    user_id = current_setting('app.current_user_id', true)::uuid OR
    client_id = current_setting('app.current_user_id', true)::uuid OR
    coach_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- Allow users to update their bookings and admins to update any
CREATE POLICY "bookings_update_policy" ON bookings
  FOR UPDATE
  TO public
  USING (
    user_id = current_setting('app.current_user_id', true)::uuid OR
    client_id = current_setting('app.current_user_id', true)::uuid OR
    coach_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  )
  WITH CHECK (
    user_id = current_setting('app.current_user_id', true)::uuid OR
    client_id = current_setting('app.current_user_id', true)::uuid OR
    coach_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- Allow users to create bookings and admins to create any
CREATE POLICY "bookings_insert_policy" ON bookings
  FOR INSERT
  TO public
  WITH CHECK (
    user_id = current_setting('app.current_user_id', true)::uuid OR
    client_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- MESSAGES TABLE POLICIES
-- Allow users to view messages they sent or received, admins can view all
CREATE POLICY "messages_select_policy" ON messages
  FOR SELECT
  TO public
  USING (
    sender_id = current_setting('app.current_user_id', true)::uuid OR
    receiver_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- Allow users to update their own messages, admins can update any
CREATE POLICY "messages_update_policy" ON messages
  FOR UPDATE
  TO public
  USING (
    sender_id = current_setting('app.current_user_id', true)::uuid OR
    receiver_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  )
  WITH CHECK (
    sender_id = current_setting('app.current_user_id', true)::uuid OR
    receiver_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- Allow users to send messages, admins can insert any
CREATE POLICY "messages_insert_policy" ON messages
  FOR INSERT
  TO public
  WITH CHECK (
    sender_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- REVIEWS TABLE POLICIES
-- Allow everyone to view reviews (public), but restrict modifications
CREATE POLICY "reviews_select_policy" ON reviews
  FOR SELECT
  TO public
  USING (true); -- Reviews are public

-- Allow users to update their own reviews, admins can update any
CREATE POLICY "reviews_update_policy" ON reviews
  FOR UPDATE
  TO public
  USING (
    reviewer_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  )
  WITH CHECK (
    reviewer_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

-- Allow users to create reviews, admins can create any
CREATE POLICY "reviews_insert_policy" ON reviews
  FOR INSERT
  TO public
  WITH CHECK (
    reviewer_id = current_setting('app.current_user_id', true)::uuid OR
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );