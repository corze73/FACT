-- Fix RLS policies to be more restrictive
-- Drop existing policies and recreate with better security

-- PROFILES TABLE - More restrictive policies
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;

-- Only allow access if user is authenticated and accessing their own data or is admin
CREATE POLICY "profiles_select_policy" ON profiles
  FOR SELECT
  TO public
  USING (
    -- Must have user context set AND (be the user OR be admin)
    current_setting('app.current_user_id', true) != '' AND
    (
      id = current_setting('app.current_user_id', true)::uuid OR
      (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
    )
  );

CREATE POLICY "profiles_update_policy" ON profiles
  FOR UPDATE
  TO public
  USING (
    current_setting('app.current_user_id', true) != '' AND
    (
      id = current_setting('app.current_user_id', true)::uuid OR
      (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
    )
  )
  WITH CHECK (
    current_setting('app.current_user_id', true) != '' AND
    (
      id = current_setting('app.current_user_id', true)::uuid OR
      (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
    )
  );

CREATE POLICY "profiles_insert_policy" ON profiles
  FOR INSERT
  TO public
  WITH CHECK (
    current_setting('app.current_user_id', true) != '' AND
    (
      id = current_setting('app.current_user_id', true)::uuid OR
      (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
    )
  );

-- BOOKINGS TABLE - More restrictive
DROP POLICY IF EXISTS "bookings_select_policy" ON bookings;
DROP POLICY IF EXISTS "bookings_update_policy" ON bookings;
DROP POLICY IF EXISTS "bookings_insert_policy" ON bookings;

CREATE POLICY "bookings_select_policy" ON bookings
  FOR SELECT
  TO public
  USING (
    current_setting('app.current_user_id', true) != '' AND
    (
      user_id = current_setting('app.current_user_id', true)::uuid OR
      client_id = current_setting('app.current_user_id', true)::uuid OR
      coach_id = current_setting('app.current_user_id', true)::uuid OR
      (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
    )
  );

CREATE POLICY "bookings_update_policy" ON bookings
  FOR UPDATE
  TO public
  USING (
    current_setting('app.current_user_id', true) != '' AND
    (
      user_id = current_setting('app.current_user_id', true)::uuid OR
      client_id = current_setting('app.current_user_id', true)::uuid OR
      coach_id = current_setting('app.current_user_id', true)::uuid OR
      (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
    )
  )
  WITH CHECK (
    current_setting('app.current_user_id', true) != '' AND
    (
      user_id = current_setting('app.current_user_id', true)::uuid OR
      client_id = current_setting('app.current_user_id', true)::uuid OR
      coach_id = current_setting('app.current_user_id', true)::uuid OR
      (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
    )
  );

CREATE POLICY "bookings_insert_policy" ON bookings
  FOR INSERT
  TO public
  WITH CHECK (
    current_setting('app.current_user_id', true) != '' AND
    (
      user_id = current_setting('app.current_user_id', true)::uuid OR
      client_id = current_setting('app.current_user_id', true)::uuid OR
      (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
    )
  );

-- MESSAGES TABLE - More restrictive
DROP POLICY IF EXISTS "messages_select_policy" ON messages;
DROP POLICY IF EXISTS "messages_update_policy" ON messages;
DROP POLICY IF EXISTS "messages_insert_policy" ON messages;

CREATE POLICY "messages_select_policy" ON messages
  FOR SELECT
  TO public
  USING (
    current_setting('app.current_user_id', true) != '' AND
    (
      sender_id = current_setting('app.current_user_id', true)::uuid OR
      receiver_id = current_setting('app.current_user_id', true)::uuid OR
      (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
    )
  );

CREATE POLICY "messages_update_policy" ON messages
  FOR UPDATE
  TO public
  USING (
    current_setting('app.current_user_id', true) != '' AND
    (
      sender_id = current_setting('app.current_user_id', true)::uuid OR
      receiver_id = current_setting('app.current_user_id', true)::uuid OR
      (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
    )
  )
  WITH CHECK (
    current_setting('app.current_user_id', true) != '' AND
    (
      sender_id = current_setting('app.current_user_id', true)::uuid OR
      receiver_id = current_setting('app.current_user_id', true)::uuid OR
      (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
    )
  );

CREATE POLICY "messages_insert_policy" ON messages
  FOR INSERT
  TO public
  WITH CHECK (
    current_setting('app.current_user_id', true) != '' AND
    (
      sender_id = current_setting('app.current_user_id', true)::uuid OR
      (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
    )
  );

-- REVIEWS remain public for reading, but restricted for modifications
DROP POLICY IF EXISTS "reviews_select_policy" ON reviews;
DROP POLICY IF EXISTS "reviews_update_policy" ON reviews;
DROP POLICY IF EXISTS "reviews_insert_policy" ON reviews;

-- Reviews are public to read
CREATE POLICY "reviews_select_policy" ON reviews
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "reviews_update_policy" ON reviews
  FOR UPDATE
  TO public
  USING (
    current_setting('app.current_user_id', true) != '' AND
    (
      reviewer_id = current_setting('app.current_user_id', true)::uuid OR
      (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
    )
  )
  WITH CHECK (
    current_setting('app.current_user_id', true) != '' AND
    (
      reviewer_id = current_setting('app.current_user_id', true)::uuid OR
      (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
    )
  );

CREATE POLICY "reviews_insert_policy" ON reviews
  FOR INSERT
  TO public
  WITH CHECK (
    current_setting('app.current_user_id', true) != '' AND
    (
      reviewer_id = current_setting('app.current_user_id', true)::uuid OR
      (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
    )
  );