# 🎯 Next Steps - Environment Variables

## ⚠️ CRITICAL: Add Environment Variables to Netlify

Your code is pushed, but **Netlify functions won't work** until you add environment variables!

---

## 🔧 How to Add Environment Variables

### 1. Go to Netlify Dashboard

**URL:** https://app.netlify.com

### 2. Select Your Site

Look for your "FACT" site in the list

### 3. Navigate to Environment Variables

**Path:** Site Settings → Environment Variables (in left sidebar)

Or direct link format:
`https://app.netlify.com/sites/[your-site-name]/settings/env`

### 4. Add DATABASE_URL

**Click:** "Add a variable"

**Key:** `DATABASE_URL`

**Value:**
```
REDACTED_NEON_URL
```

**Scopes:** 
- ✅ Production
- ✅ Deploy previews
- ✅ Branch deploys (optional)

**Click:** "Create variable"

### 5. Add JWT_SECRET

First, generate a secure secret on your computer:

```bash
openssl rand -base64 32
```

Copy the output (it will look like: `Xa8k2Pm9...`)

**Click:** "Add a variable"

**Key:** `JWT_SECRET`

**Value:** [Paste the secret you just generated]

**Scopes:** Same as above

**Click:** "Create variable"

---

## ✅ Verify Environment Variables

You should now see:

```
DATABASE_URL    [hidden]    Production, Deploy previews
JWT_SECRET      [hidden]    Production, Deploy previews
```

---

## 🚀 Trigger Redeploy

After adding environment variables:

**Option 1: Automatic**
- Netlify may auto-redeploy when you save env vars

**Option 2: Manual**
- Go to: Deploys tab
- Click: "Trigger deploy" → "Deploy site"

**Option 3: Git Push (if needed)**
```bash
git commit --allow-empty -m "Trigger redeploy with env vars"
git push origin main
```

---

## 🔍 What Happens Next

1. **Netlify receives your push** ✅ (Already done)
2. **Netlify starts build** (In progress or queued)
3. **Build completes** (~2-3 minutes)
4. **Functions are bundled** with your environment variables
5. **Site goes live** 🎉

---

## 📊 Monitor Your Deploy

### Go to Deploys Tab

**URL:** https://app.netlify.com/sites/[your-site-name]/deploys

### You'll see:

**Status options:**
- 🟡 **Building** - In progress (wait 2-3 min)
- 🟢 **Published** - Live! ✅
- 🔴 **Failed** - Check logs

### Click on Latest Deploy to See:

- Build logs
- Function bundling
- Deploy summary
- Live site URL

---

## 🧪 Test Your Deployment

### Once Status is "Published":

1. **Visit your site URL** (shown in Netlify)
   - Usually: `https://[your-site-name].netlify.app`

2. **Open browser DevTools**
   - Press F12 or Cmd+Opt+I
   - Go to Console tab

3. **Try to log in**
   - Click "Login" button
   - Complete Google OAuth
   - Check for errors in console

4. **Check Network tab**
   - Look for requests to `/api/users`, `/api/bookings`, etc.
   - Should see 200 status codes
   - Check response data

---

## ✅ Success Indicators

### Netlify Dashboard
- ✅ Build status: "Published"
- ✅ Functions tab shows 3 functions (users, bookings, messages)
- ✅ No errors in deploy logs

### Your Site
- ✅ Site loads without errors
- ✅ Can log in with Google
- ✅ Profile page displays
- ✅ No console errors

### Browser Network Tab
- ✅ API calls to `/.netlify/functions/users` etc.
- ✅ 200 status codes
- ✅ JSON responses with data

---

## 🐛 If Something Goes Wrong

### Build Failed?
1. Check deploy logs for error message
2. Verify environment variables are set
3. Check syntax in netlify.toml

### Functions Not Appearing?
1. Verify `netlify/functions/` directory exists in repo
2. Check netlify.toml has correct functions path
3. Re-deploy after adding env vars

### API Calls Failing?
1. Check environment variables are set correctly
2. Verify DATABASE_URL is exactly as shown
3. Check browser console for specific errors
4. Look at function logs in Netlify dashboard

### Database Connection Errors?
1. Confirm DATABASE_URL is correct (no typos)
2. Check Neon database is active (not paused)
3. Verify connection string works locally

---

## 🎯 Quick Commands Reference

### View Environment Variables
```bash
# In Netlify Dashboard:
# Site Settings → Environment Variables
```

### Redeploy
```bash
# Trigger via Git
git commit --allow-empty -m "Redeploy"
git push origin main

# Or use Netlify CLI
netlify deploy --prod
```

### View Logs
```bash
# In Netlify Dashboard:
# Deploys → [Latest deploy] → Deploy log
# Functions → [Function name] → Function log
```

### Check Site Status
```bash
# Visit your Netlify site URL
# Or check: Netlify Dashboard → Site overview
```

---

## ⏱️ Estimated Timeline

- **Adding env vars:** 2 minutes
- **Build time:** 2-3 minutes
- **Going live:** 5 minutes total

**You should be live in ~5 minutes!** 🚀

---

## 📋 Checklist

- [ ] Added DATABASE_URL to Netlify
- [ ] Generated JWT_SECRET (openssl rand -base64 32)
- [ ] Added JWT_SECRET to Netlify
- [ ] Triggered redeploy
- [ ] Waited for build to complete
- [ ] Verified "Published" status
- [ ] Visited site URL
- [ ] Tested login
- [ ] Checked for errors
- [ ] Verified functions work

---

## 🎉 You're Almost There!

**Current Status:**
- ✅ Code pushed to GitHub
- ⏳ Environment variables (do this now!)
- ⏳ Deploy and test

**Time to completion:** ~5 minutes

**Next action:** Add those environment variables in Netlify! 👆

---

**Need help?** Check DEPLOYMENT_CHECKLIST.md for detailed troubleshooting!
