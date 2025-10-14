-- Add video clip fields to profiles table for coaches
-- Coaches can upload up to 3 video clips showcasing their coaching sessions

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS video_clip_1 TEXT,
ADD COLUMN IF NOT EXISTS video_clip_2 TEXT,
ADD COLUMN IF NOT EXISTS video_clip_3 TEXT;

COMMENT ON COLUMN profiles.avatar_url IS 'URL to user/coach profile picture';
COMMENT ON COLUMN profiles.video_clip_1 IS 'URL to first coaching session video clip';
COMMENT ON COLUMN profiles.video_clip_2 IS 'URL to second coaching session video clip';
COMMENT ON COLUMN profiles.video_clip_3 IS 'URL to third coaching session video clip';
