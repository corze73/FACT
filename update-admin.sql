-- Update a user to admin role
-- Replace 'your.email@example.com' with your actual Google account email

UPDATE profiles 
SET role = 'admin', 
    user_type = 'admin',
    updated_at = NOW()
WHERE email = 'your.email@example.com';

-- Verify the update
SELECT id, email, full_name, role, user_type, created_at 
FROM profiles 
WHERE email = 'your.email@example.com';
