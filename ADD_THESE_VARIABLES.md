# ⚠️ IMPORTANT: Add Missing Environment Variables

## You Need to Add 2 More Variables

Your screenshot shows you have `VITE_DATABASE_URL`, but the **Netlify Functions** need their own variables (without VITE_ prefix).

### 1. DATABASE_URL (for Netlify Functions)

**Click:** "Add a variable" button in Netlify

**Key:** `DATABASE_URL` (NO "VITE_" prefix!)

**Value:** 
```
REDACTED_NEON_URL
```

**Scopes:** All (or at least Production)

---

### 2. JWT_SECRET (for Netlify Functions)

**First, generate the secret:**
```bash
openssl rand -base64 32
```

**Then add in Netlify:**

**Key:** `JWT_SECRET`

**Value:** [Paste the output from the command above]

**Scopes:** All (or at least Production)

---

## Why Do You Need Both?

### VITE_DATABASE_URL (You already have ✅)
- Used during **Vite build process**
- Accessible in your React code
- Currently used for direct database access (our fallback)

### DATABASE_URL (You need to add)
- Used by **Netlify Functions at runtime**
- Server-side only
- NOT accessible from browser
- Required for secure API endpoints

---

## After Adding

Your environment variables should look like:

```
DATABASE_URL              [hidden]    Production, Deploy previews
JWT_SECRET                [hidden]    Production, Deploy previews
VITE_DATABASE_URL         [hidden]    Production (existing)
VITE_GOOGLE_CLIENT_ID     [hidden]    Production (existing)
```

---

## Then Trigger Redeploy

After adding both variables:

1. **Go to:** Deploys tab
2. **Click:** "Trigger deploy" → "Deploy site"

Or just push an empty commit:
```bash
git commit --allow-empty -m "Trigger redeploy with new env vars"
git push origin main
```

---

## Expected Timeline

- Add variables: 1 minute
- Trigger redeploy: 10 seconds
- Build completes: 2-3 minutes
- **Total: ~5 minutes to live**

---

**Once both are added, your functions will work! 🚀**
