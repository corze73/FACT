# Quick Deployment Guide - Phase 2

## Current Status

✅ **Completed:**
- Backend API (Netlify functions) created
- Frontend API client implemented
- Entities migrated to use secure API
- Fallback mechanism for graceful degradation
- Vite dev server running at http://localhost:5173

⚠️ **Issue:**
- Netlify CLI has permission error (cannot test functions locally)

## Deploy Now (Recommended)

### Option 1: Deploy to Netlify Production

1. **Commit and push:**
```bash
git add .
git commit -m "Phase 2: Secure API migration complete"
git push origin main
```

2. **Configure Netlify:**
   - Go to https://app.netlify.com
   - Select your site
   - Go to Site Settings → Environment Variables
   - Add these variables:
     ```
     DATABASE_URL = REDACTED_NEON_URL
     
     JWT_SECRET = [Generate with: openssl rand -base64 32]
     ```

3. **Trigger deploy:**
   - Push to GitHub (auto-deploys)
   - OR run: `npm run deploy`

4. **Verify:**
   - Visit your Netlify URL
   - Check function logs
   - Test user flows

### Option 2: Deploy to Netlify Staging

```bash
# Deploy to draft URL (for testing)
netlify deploy

# View draft URL in output
# Test thoroughly
# If all good, deploy to production:
netlify deploy --prod
```

### Option 3: Fix Local Testing

If you want to test Netlify functions locally:

```bash
# 1. Clean Netlify config
rm -rf ~/.netlify
mkdir -p ~/.netlify
chmod -R 755 ~/.netlify

# 2. Fix preferences (needs sudo password)
sudo rm -rf ~/Library/Preferences/netlify
sudo mkdir -p ~/Library/Preferences/netlify
sudo chmod -R 755 ~/Library/Preferences/netlify
sudo chown -R $USER ~/Library/Preferences/netlify

# 3. Try dev server again
npm run dev
```

## What Gets Deployed

### Netlify Functions (Serverless Backend)
- `/.netlify/functions/users`
- `/.netlify/functions/bookings`
- `/.netlify/functions/messages`

### Frontend (Static Site)
- React app built with Vite
- Served from `/dist` directory
- API calls routed to functions

## Testing Checklist

Once deployed, test these flows:

### Authentication
- [ ] Login with Google
- [ ] View own profile
- [ ] Logout

### User Profile
- [ ] Update profile info
- [ ] Upload avatar
- [ ] View other profiles

### Booking
- [ ] Create booking
- [ ] View booking details
- [ ] Update booking status
- [ ] Cancel booking
- [ ] Filter bookings

### Messaging
- [ ] Send message
- [ ] View conversation
- [ ] Mark as read
- [ ] Real-time updates

### Admin Features (if admin)
- [ ] View all users
- [ ] View all bookings
- [ ] Update user roles

## Check Function Logs

After deploying:

1. Go to Netlify Dashboard
2. Click "Functions" tab
3. Click on each function to see logs
4. Look for errors or warnings

## Monitor Performance

Check these metrics:

1. **Function Duration:** Should be < 500ms
2. **Error Rate:** Should be < 1%
3. **Cold Start:** First request may be slower (1-2 seconds)

## Rollback if Needed

If something breaks:

```bash
# Restore old entities.jsx
cp src/api/entities-backup.jsx src/api/entities.jsx
git commit -m "Rollback: Restore direct DB access"
git push
```

The fallback mechanism should prevent total breakage, but if critical:

```bash
# Revert last commit
git revert HEAD
git push
```

## Environment Variables

Make sure these are set in Netlify:

```env
# Production (in Netlify Dashboard)
DATABASE_URL=REDACTED_NEON_URL

JWT_SECRET=[Run: openssl rand -base64 32]

# Local (.env file - already created)
Same as above
```

## Success Indicators

You'll know it's working when:

✅ Functions show in Netlify dashboard
✅ API calls in browser network tab show `/api/*` endpoints
✅ No database connection errors in console
✅ Profile page loads correctly
✅ Bookings can be created/viewed
✅ Messages can be sent

## Troubleshooting

### "Failed to fetch"
- Check Netlify function logs
- Verify environment variables
- Check CORS headers

### "User not found"
- First login creates user via API
- Check database has user record

### Slow responses
- First request is slower (cold start)
- Subsequent requests should be fast
- Check function execution time in logs

### Database errors
- Verify DATABASE_URL is correct
- Check Neon database is active
- Verify RLS policies allow access

## Next Steps After Deployment

1. Monitor for 24 hours
2. Check error rates
3. Review function logs
4. Optimize slow queries
5. Plan Phase 3 (migrate remaining entities)

---

**Quick Start:** Just push to GitHub, add env vars to Netlify, and you're done! 🚀
