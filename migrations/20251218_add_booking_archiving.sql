-- 20251218_add_booking_archiving.sql
-- Adds soft-archive support for bookings (admin action + optional automation later)

BEGIN;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS archived_by uuid NULL;

-- Index for fast admin dashboard queries (status + archive filter)
CREATE INDEX IF NOT EXISTS bookings_active_status_idx
  ON public.bookings (status)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS bookings_archived_idx
  ON public.bookings (archived_at)
  WHERE is_archived = true;

-- Optional FK (only if your profiles table is the source of user ids)
-- Commented out to avoid migration failure if your ids don’t line up exactly.
-- ALTER TABLE public.bookings
--   ADD CONSTRAINT bookings_archived_by_fkey
--   FOREIGN KEY (archived_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMIT;