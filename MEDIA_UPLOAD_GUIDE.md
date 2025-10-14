# Media Upload Feature Guide

## Overview
This update adds profile picture and video clip upload functionality to both Coach and User profiles, matching the layout shown in your design mockup.

## Changes Made

### 1. Database Migration
**File:** `/migrations/20251014_add_media_fields.sql`

Adds the following columns to the `profiles` table:
- `avatar_url` (already existed, now used)
- `video_clip_1` (new)
- `video_clip_2` (new)
- `video_clip_3` (new)

**To Apply Migration:**
```bash
# Connect to your Neon database and run:
psql "YOUR_NEON_CONNECTION_STRING" -f migrations/20251014_add_media_fields.sql
```

### 2. CoachProfile.jsx Updates
**Features Added:**
- ✅ Profile picture upload with preview
- ✅ Upload up to 3 video clips showcasing coaching sessions
- ✅ Two-column layout: Form fields (left) + Media uploads (right)
- ✅ Image validation (max 5MB, image types only)
- ✅ Video validation (max 50MB, video types only)
- ✅ Remove/replace video functionality
- ✅ Responsive design matching your mockup

### 3. UserProfile.jsx Updates
**Features Added:**
- ✅ Profile picture upload with preview
- ✅ Same two-column layout as coach profile
- ✅ Image validation (max 5MB)
- ✅ No video uploads (user-specific, coaches only)

## How It Works

### Profile Picture Upload
1. Click the upload area or "Change Photo" button
2. Select an image file (JPG, PNG, etc.)
3. Image is validated (must be < 5MB)
4. Preview appears immediately using base64 encoding
5. Click "Save Changes" to persist to database

### Video Clip Upload (Coaches Only)
1. Click on any of the 3 video placeholder boxes
2. Select a video file (MP4, MOV, etc.)
3. Video is validated (must be < 50MB)
4. Video preview appears with controls
5. Click the X button to remove a video
6. Click "Save Changes" to persist to database

## Current Limitations

### ⚠️ Important Notes:
1. **File Storage:** Currently uses base64 encoding which stores files directly in the database
   - This works for development/testing
   - For production, you should migrate to proper file storage (Supabase Storage, AWS S3, etc.)
   
2. **File Size Limits:** 
   - Images: 5MB max
   - Videos: 50MB max
   - These are client-side validations only

3. **Admin View Mode:**
   - When admins view user/coach profiles, the upload functionality is still available
   - You may want to disable uploads when `isViewingAsAdmin === true`

## Next Steps for Production

### Recommended Improvements:

1. **Add Cloud Storage Integration**
   ```javascript
   // Example with Supabase Storage
   const uploadToStorage = async (file, bucket, path) => {
     const { data, error } = await supabase.storage
       .from(bucket)
       .upload(path, file);
     return data?.path;
   };
   ```

2. **Add Progress Indicators**
   - Show upload progress bars
   - Display loading spinners during upload
   - Show success/error messages

3. **Add Image Compression**
   - Resize/compress images before upload
   - Use libraries like `browser-image-compression`

4. **Enhance Video Handling**
   - Generate video thumbnails
   - Add video duration validation
   - Compress videos before upload

5. **Disable Uploads for Admin View Mode**
   ```javascript
   const isReadOnly = isViewingAsAdmin;
   // Then conditionally disable file inputs
   ```

## Testing Checklist

- [ ] Upload a profile picture
- [ ] Change an existing profile picture
- [ ] Upload 3 videos (coaches)
- [ ] Remove and replace a video
- [ ] Try uploading files that are too large
- [ ] Try uploading wrong file types
- [ ] Save changes and reload to verify persistence
- [ ] Test on mobile devices
- [ ] Test admin viewing another user's profile

## UI/UX Features

✨ **Visual Enhancements:**
- Hover states on upload areas
- Smooth transitions and animations
- Responsive grid layout
- Clear visual feedback
- Matching colors to your app theme
- Icons from lucide-react

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify database migration was applied
3. Check file size and type requirements
4. Ensure avatar_url and video_clip fields exist in database
