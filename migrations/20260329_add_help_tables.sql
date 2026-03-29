-- ============================================================
-- Migration: 20260329_add_help_tables.sql
-- Adds help_faqs (editable FAQ store) and help_analytics
-- (per-event engagement tracking) tables, then seeds the
-- default FAQ entries from the static helpFaq.json content.
-- ============================================================

-- --------------------------------------------------------
-- 1. help_faqs
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS help_faqs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT        NOT NULL UNIQUE,
  role        TEXT        NOT NULL CHECK (role IN ('coach','client','admin','both')),
  category    TEXT        NOT NULL,
  question    TEXT        NOT NULL,
  answer      TEXT        NOT NULL,
  keywords    TEXT[]      NOT NULL DEFAULT '{}',
  position    INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------
-- 2. help_analytics
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS help_analytics (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT        NOT NULL,
  role        TEXT,
  faq_id      TEXT,
  search_term TEXT,
  category    TEXT,
  user_id     UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_help_analytics_event_type ON help_analytics (event_type);
CREATE INDEX IF NOT EXISTS idx_help_analytics_created_at  ON help_analytics (created_at);

-- --------------------------------------------------------
-- 3. Seed default FAQ entries (idempotent via ON CONFLICT)
-- --------------------------------------------------------
INSERT INTO help_faqs (slug, role, category, question, answer, keywords, position) VALUES

-- COACH entries
('coach-verification-flow',     'coach', 'verification',
 'How does coach verification work?',
 'Upload your qualification and background-check documentation in your coach profile. Once submitted, your documents move to pending and are reviewed by admin.',
 ARRAY['verification','compliance','admin','approval'], 10),

('coach-awaiting-approval',     'coach', 'verification',
 'What does ''Awaiting Approval'' mean?',
 'It means your documents are in the admin verification queue. You can still access your account while review is in progress, but final verification actions depend on admin review.',
 ARRAY['pending','approval','status'], 20),

('coach-no-bookings',           'coach', 'bookings',
 'Why do I not see bookings yet?',
 'Bookings only appear after clients create sessions with you. New coaches will often see an empty list at first.',
 ARRAY['empty','dashboard','my bookings'], 30),

('coach-direct-messages',       'coach', 'messaging',
 'Can I message users without a booking?',
 'Yes. Admin/support messages can be direct messages that are not tied to a booking.',
 ARRAY['admin','support','direct','conversation'], 40),

('coach-background-required',   'coach', 'verification',
 'Do I need a background-check file if I select yes?',
 'Yes. If you mark that you have a background check, you must upload the supporting document before compliance can be submitted successfully.',
 ARRAY['background','document','required'], 50),

('coach-rejected-docs',         'coach', 'verification',
 'What happens if a document is rejected?',
 'You will see rejection status and admin notes in your coach profile. Upload an updated document and save again to return it to pending review.',
 ARRAY['rejected','notes','resubmit'], 60),

('coach-edit-profile-visibility','coach', 'onboarding',
 'Which parts of my profile are visible to clients?',
 'Your public coaching profile fields, services, and media can be visible to clients. Keep contact and qualification details accurate and professional.',
 ARRAY['public','profile','visibility'], 70),

('coach-cancel-session',        'coach', 'bookings',
 'How do I cancel a confirmed booking?',
 'Use your dashboard booking actions to cancel and include a reason where prompted. The booking status updates and appears in cancelled history.',
 ARRAY['cancel','confirmed','reason'], 80),

('coach-session-status',        'coach', 'bookings',
 'What are session statuses like pending, confirmed, completed?',
 'Pending means awaiting action, confirmed means accepted/scheduled, completed means session finished, and cancelled means the booking was cancelled.',
 ARRAY['status','pending','confirmed','completed','cancelled'], 90),

('coach-payout-question',       'coach', 'payments',
 'Who do I contact about payment issues?',
 'Use in-app messages or support email with your booking reference and date so support can investigate quickly.',
 ARRAY['payments','payout','support'], 100),

-- CLIENT entries
('client-find-coach',           'client', 'onboarding',
 'How do I find the right coach?',
 'Use filters for service type, location, and profile details, then compare coach profiles and reviews before booking.',
 ARRAY['find','filter','search','coach'], 110),

('client-my-bookings',          'client', 'bookings',
 'Where are my bookings?',
 'Open My Bookings to see upcoming, past, and cancelled sessions.',
 ARRAY['upcoming','past','cancelled'], 120),

('client-messaging',            'client', 'messaging',
 'How does messaging work?',
 'Messages can be tied to a booking, and you may also receive direct support/admin messages.',
 ARRAY['chat','conversation','support'], 130),

('client-support',              'client', 'support',
 'Who do I contact for support?',
 'Use in-app messages for support contact or email support@findacoachtoday.com.',
 ARRAY['help','support','contact'], 140),

('client-booking-create',       'client', 'bookings',
 'How do I create a booking?',
 'Open a coach profile, choose a service/session option, and submit your booking request. You can then track status in My Bookings.',
 ARRAY['create','new booking','request'], 150),

('client-reschedule',           'client', 'bookings',
 'Can I reschedule a session?',
 'Yes, where reschedule options are available. Submit a reschedule request from booking actions and wait for confirmation.',
 ARRAY['reschedule','change date','booking actions'], 160),

('client-cancel',               'client', 'bookings',
 'How do I cancel a booking?',
 'Use the cancel action in booking details, provide context if requested, and check the cancelled tab afterward.',
 ARRAY['cancel booking','cancelled tab'], 170),

('client-review',               'client', 'onboarding',
 'When can I leave a review?',
 'Reviews are typically submitted after completed sessions. Open the relevant booking and use the review option when available.',
 ARRAY['review','feedback','completed'], 180),

('client-security',             'client', 'security',
 'What should I do if I suspect unauthorized account access?',
 'Change your password, revoke active sessions, and contact support with the approximate time and affected actions.',
 ARRAY['unauthorized','security','revoke sessions'], 190),

('client-payment-proof',        'client', 'payments',
 'What should I include in a payment support request?',
 'Include booking reference, date/time, amount, and screenshots of any error so support can verify transaction records faster.',
 ARRAY['payment','receipt','amount','support'], 200),

-- ADMIN entries
('admin-verification-dot',      'admin', 'verification',
 'When does the red dot appear on Verifications?',
 'The red indicator appears when there are pending coach verification items in the admin queue.',
 ARRAY['admin','red dot','verifications'], 210),

('admin-messages-dot',          'admin', 'messaging',
 'When does the red dot appear on Messages?',
 'The red indicator appears when unread direct message threads exist for the admin account.',
 ARRAY['admin','messages','unread','red dot'], 220),

('admin-verification-process',  'admin', 'verification',
 'How should admin review coach compliance files?',
 'Open the verification queue, review uploaded qualification/background files, leave notes where needed, and set approve/reject statuses accordingly.',
 ARRAY['admin','review','approve','reject'], 230),

('admin-direct-message',        'admin', 'messaging',
 'Are admin messages always tied to bookings?',
 'No. Admin/support can message users directly without a booking, and those conversations appear as direct threads.',
 ARRAY['direct','booking_id','support'], 240),

('admin-audit',                 'admin', 'security',
 'Where do I check key admin actions?',
 'Use Admin Audit Logs and Operations pages to inspect critical actions, account events, and platform activity.',
 ARRAY['audit','operations','logs'], 250),

-- BOTH entries
('both-booking-reference',      'both', 'bookings',
 'What is a booking reference used for?',
 'Your booking reference helps support quickly locate session details and investigate booking or payment queries.',
 ARRAY['reference','support','booking id'], 260),

('both-account-security',       'both', 'security',
 'What should I do if account details look wrong?',
 'Update your profile immediately and revoke sessions from account tools if needed, then message support so we can review account activity.',
 ARRAY['security','revoke sessions','account'], 270)

ON CONFLICT (slug) DO NOTHING;
