-- Check current user context and fix RLS policies
SELECT current_setting('app.current_user_id', true) as current_user_id;

-- Check if there are any issues with the policies
\dp+ profiles
\dp+ bookings  
\dp+ messages
\dp+ reviews