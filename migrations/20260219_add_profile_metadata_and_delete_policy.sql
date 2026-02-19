-- Add metadata column for test flags and allow admin-only deletes on profiles

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE POLICY IF NOT EXISTS "profiles_delete_policy" ON profiles
  FOR DELETE
  TO public
  USING (
    current_setting('app.current_user_id', true) != '' AND
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

CREATE POLICY IF NOT EXISTS "bookings_delete_policy" ON bookings
  FOR DELETE
  TO public
  USING (
    current_setting('app.current_user_id', true) != '' AND
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

CREATE POLICY IF NOT EXISTS "messages_delete_policy" ON messages
  FOR DELETE
  TO public
  USING (
    current_setting('app.current_user_id', true) != '' AND
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );

CREATE POLICY IF NOT EXISTS "reviews_delete_policy" ON reviews
  FOR DELETE
  TO public
  USING (
    current_setting('app.current_user_id', true) != '' AND
    (SELECT role FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid) = 'admin'
  );
