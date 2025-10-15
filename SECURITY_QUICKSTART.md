# 🚀 FACT Security Quick Start Guide

## Immediate Actions (Do This Now!)

### 1. Apply Critical RLS Policies ⚠️

The new availability tables are missing security policies. Apply them immediately:

```bash
cd /Users/corycharles/FACT

# Apply the RLS policies
psql 'REDACTED_NEON_URL' -f migrations/20251016_add_rls_for_availability.sql
```

**What this does:**
- Secures `coach_availability` table
- Secures `coach_recurring_availability` table
- Ensures only coaches can edit their own availability
- Allows public viewing (necessary for booking system)

---

### 2. Enable Automated Security Scanning 🤖

#### Option A: GitHub Dependabot (Free, Built-in)

Already configured! Dependabot will:
- ✅ Scan dependencies daily
- ✅ Create PRs for security updates
- ✅ Group updates intelligently
- ✅ Auto-label security issues

**Verify it's working:**
1. Go to: https://github.com/corze73/FACT/security/dependabot
2. You should see the configuration is active
3. Check the "Security" tab for any existing alerts

#### Option B: Snyk (Recommended for Production)

```bash
# 1. Sign up at https://snyk.io (free for open source)
# 2. Install Snyk CLI
npm install -g snyk

# 3. Authenticate
snyk auth

# 4. Test your project
snyk test

# 5. Monitor continuously
snyk monitor
```

Add Snyk token to GitHub:
1. Go to: https://github.com/corze73/FACT/settings/secrets/actions
2. Click "New repository secret"
3. Name: `SNYK_TOKEN`
4. Value: Your Snyk API token from https://app.snyk.io/account

---

### 3. Set Up Security Alerts 🚨

#### Configure Slack Notifications

1. Create Slack webhook:
   - Go to: https://api.slack.com/messaging/webhooks
   - Click "Create New App"
   - Enable "Incoming Webhooks"
   - Copy the webhook URL

2. Add to GitHub Secrets:
   - Go to: https://github.com/corze73/FACT/settings/secrets/actions
   - Add secret: `SLACK_WEBHOOK_URL`
   - Value: Your webhook URL

3. Test it:
   ```bash
   # The security workflow will now send Slack alerts on failures
   ```

#### Configure Email Alerts

Add these secrets to GitHub:
- `SMTP_SERVER` (e.g., smtp.gmail.com)
- `SMTP_PORT` (e.g., 587)
- `SMTP_USERNAME` (your email)
- `SMTP_PASSWORD` (app password for Gmail)
- `SECURITY_TEAM_EMAIL` (where to send alerts)

---

### 4. Run Security Audit Now 🔍

```bash
cd /Users/corycharles/FACT

# Check for known vulnerabilities
npm audit

# Fix automatically fixable issues
npm audit fix

# For vulnerabilities requiring manual review
npm audit fix --force  # ⚠️ May cause breaking changes

# Get a detailed report
npm audit --json > security-audit.json
```

---

## Daily Security Practices

### Morning Checklist
- [ ] Check GitHub Security alerts
- [ ] Review Dependabot PRs
- [ ] Check for failed security workflows

### Before Each Deploy
```bash
# 1. Run security checks
npm audit

# 2. Check for secrets in code
git diff | grep -i "password\|secret\|api_key"

# 3. Verify environment variables
npm run check-env  # (you'll need to create this script)

# 4. Run tests
npm test
```

---

## What's Been Set Up

### ✅ Completed

1. **Security Audit Report** - Comprehensive analysis in `SECURITY_AUDIT_REPORT.md`
2. **Implementation Plan** - Step-by-step guide in `SECURITY_IMPLEMENTATION_PLAN.md`
3. **RLS Policies** - Ready to apply in `migrations/20251016_add_rls_for_availability.sql`
4. **GitHub Actions Workflow** - Automated scanning in `.github/workflows/security-scan.yml`
5. **Dependabot Configuration** - Auto-updates in `.github/dependabot.yml`

### Automated Security Scans Include:

- **Dependency vulnerabilities** - npm audit + Snyk
- **Code security** - CodeQL analysis
- **Secret scanning** - TruffleHog
- **SQL injection patterns** - Custom checks
- **XSS vulnerabilities** - Custom checks
- **Environment security** - Exposed secrets check

### 🚨 Critical Issues Found

1. **Database URL exposed in client** - See SECURITY_AUDIT_REPORT.md #3
2. **Missing RLS policies** - Apply the migration now (see step 1 above)
3. **No rate limiting** - Implement in backend (see implementation plan)
4. **No CSP headers** - Add to production deployment
5. **File upload validation** - Strengthen in backend

---

## Priority Actions This Week

### Day 1 (Today)
- ✅ Apply RLS policies (migration file created)
- [ ] Enable Dependabot (already configured, just verify)
- [ ] Run `npm audit` and fix issues
- [ ] Set up Slack notifications

### Day 2-3
- [ ] Sign up for Snyk
- [ ] Configure Snyk token in GitHub
- [ ] Review and merge any Dependabot PRs
- [ ] Test security workflow

### Day 4-7
- [ ] Implement rate limiting (see implementation plan)
- [ ] Add input validation with Zod
- [ ] Move database access to backend API
- [ ] Add security headers

---

## Monitoring Dashboard

### GitHub Security Tab
Monitor at: https://github.com/corze73/FACT/security

You'll see:
- Dependabot alerts
- Code scanning results
- Secret scanning alerts

### Snyk Dashboard
After setup: https://app.snyk.io/org/your-org/projects

Shows:
- Vulnerability trends
- Fix recommendations
- License issues

---

## Emergency Contacts

### If You Detect a Security Breach:

1. **Immediately:**
   - Rotate all credentials (database, API keys, etc.)
   - Review access logs
   - Document what happened

2. **Within 1 hour:**
   - Notify affected users if data exposed
   - Contact your hosting provider
   - Preserve logs for investigation

3. **Within 24 hours:**
   - File incident report
   - Review and patch vulnerability
   - Update security procedures

### Security Resources

- **GitHub Security Advisory Database**: https://github.com/advisories
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **Neon Security**: https://neon.tech/docs/security
- **Stripe Security**: https://stripe.com/docs/security

---

## Testing Your Security Setup

### Verify Workflows Are Running

```bash
# Check latest workflow runs
gh run list --workflow=security-scan.yml

# View specific run
gh run view <run-id>
```

### Manual Security Test

```bash
# 1. Test for exposed secrets
grep -r "postgresql://" src/

# 2. Check dependencies
npm audit

# 3. Test SQL injection patterns
grep -r '\${.*}.*FROM' src/

# 4. Check for XSS risks
grep -r 'dangerouslySetInnerHTML\|innerHTML\|eval(' src/
```

---

## Questions?

**Found a security issue?**
- Email: security@findacoachtoday.com (set this up!)
- Or create a private security advisory on GitHub

**Need help?**
- Review the detailed audit report: `SECURITY_AUDIT_REPORT.md`
- Follow the implementation plan: `SECURITY_IMPLEMENTATION_PLAN.md`
- Check GitHub Security docs: https://docs.github.com/en/code-security

---

## Next Steps

1. **Apply RLS policies** (step 1 above) - DO THIS NOW
2. **Set up Snyk** - Takes 10 minutes
3. **Configure alerts** - Slack/email notifications
4. **Review weekly** - Check security tab every Monday
5. **Plan Phase 2** - Follow implementation plan for backend API

**Remember:** Security is an ongoing process, not a one-time task! 🔒
