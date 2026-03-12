-- Transfer admin access to a new account.
--
-- Default target is support@findacoachtoday.com.
-- Replace old_admin@example.com with your current admin email.
--
-- IMPORTANT:
-- 1) Ensure support@findacoachtoday.com has already signed up once.
-- 2) Run in a SQL client connected to production DB as an admin user.

BEGIN;

-- Promote the support account to full admin in profiles.
UPDATE profiles
SET role = 'admin',
    user_type = 'admin',
    admin_scope = 'full',
    updated_at = NOW()
WHERE email = 'support@findacoachtoday.com';

-- Keep identity table in sync.
UPDATE users
SET role = 'admin',
    updated_at = NOW()
WHERE email = 'support@findacoachtoday.com';

-- Optional: demote previous admin account to client.
-- Uncomment if you want to remove admin privileges from the old address.
-- UPDATE profiles
-- SET role = 'user',
--     user_type = 'client',
--     admin_scope = 'read_only',
--     updated_at = NOW()
-- WHERE email = 'old_admin@example.com';

-- UPDATE users
-- SET role = 'user',
--     updated_at = NOW()
-- WHERE email = 'old_admin@example.com';

COMMIT;

-- Verify admin accounts after the change.
SELECT id, email, full_name, role, user_type, admin_scope, is_active, updated_at
FROM profiles
WHERE user_type = 'admin'
ORDER BY updated_at DESC;
