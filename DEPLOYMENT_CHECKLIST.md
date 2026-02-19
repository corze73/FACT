# 🚀 Pre-Launch Deployment Checklist - FACT

## ✅ Phase 1 Completed
- [x] Database migration to Neon Postgres
- [x] Country/City location fields
- [x] Pagination (coaches: 24/page, admin users: 20/page)
- [x] Toast notifications for main flows
- [x] Production console.logs removed from main flows
- [x] Autofill disabled on registration

## ✅ Phase 2 Completed (Infrastructure)
- [x] **Rate Limiting** - Applied to all Netlify functions
  - Auth endpoints: 5 requests per 15 min
  - Mutations: 30 requests per min
  - Reads: 200 requests per min
  - Stripe: Protected webhook endpoints
- [x] **Standardized Error Handling**
  - Custom error types
  - Database error mapping
  - Consistent error responses
  - Error handler utility
- [x] **React Query** - Caching and state management
  - Query client configured
  - Custom hooks created
  - Cache invalidation strategies
  - React Query DevTools (dev only)
- [x] **Mobile Responsiveness**
  - Responsive breakpoints throughout
  - Touch-friendly UI components
  - Mobile-first approach
  - Audit documentation created

## 🔧 Pre-Launch Tasks

### 1. Code Quality
- [ ] Convert remaining `alert()` calls to toast notifications (42 occurrences)
  - Priority: User-facing pages (UserProfile, CoachProfile, MyBookings)
  - Lower priority: Admin pages, edge cases
- [ ] Review client-side `console.log` statements (84 occurrences)
  - Keep: devLog/devWarn utilities
  - Remove: Debug statements in production code
  - Keep: Server-side logs (Netlify functions)
- [ ] Remove development-only components
  - [ ] Check if `DataDiagnostic.jsx` is used in production
  - [ ] Check if `DevelopmentDisclaimer.jsx` should be shown

### 2. Security Audit
- [x] Rate limiting implemented
- [x] RLS (Row-Level Security) in database
- [x] Environment variables properly configured
- [ ] HTTPS enforced in production
- [ ] CORS headers properly configured
- [ ] Stripe webhook signature verification
- [ ] No API keys in client-side code
- [ ] Session management secure
- [ ] Password requirements enforced (min 6 chars)

### 3. Performance Optimization
- [x] React Query caching (5-10 min stale times)
- [x] Pagination implemented
- [ ] Image optimization
  - [ ] Compress uploaded images
  - [ ] Lazy load off-screen images
  - [ ] Use proper image formats (WebP where possible)
- [ ] Code splitting (if bundle size large)
- [ ] Minification enabled (Vite build)

### 4. Database Health
- [x] 12 tables present and verified
- [x] RLS policies active
- [x] Indexes on frequently queried columns
- [ ] Run cleanup script: `node scripts/cleanup-dummy-coaches.js`
- [ ] Verify no test/dummy data in production DB
- [ ] Database backups configured (Neon auto-backup)

### 5. Environment Configuration

#### Production Environment Variables
Check in Netlify dashboard:
- [ ] `DATABASE_URL` - Neon production database
- [ ] `APP_JWT_SECRET` - Auth token signing secret
- [ ] `STRIPE_SECRET_KEY` - Production Stripe key
- [ ] `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- [ ] `STRIPE_PUBLISHABLE_KEY` or `VITE_STRIPE_PUBLISHABLE_KEY`
- [ ] `GOOGLE_CLIENT_ID` - Google OAuth (if using)
- [ ] `GOOGLE_CLIENT_SECRET` - Google OAuth (if using)

#### Build Environment Variables
- [ ] `VITE_DATABASE_URL` - Should NOT be set in production (security)
- [ ] All `VITE_*` variables are for build-time only

### 6. Third-Party Services

#### Stripe
- [ ] Switch from test mode to live mode
- [ ] Verify webhook endpoint: `https://your-domain.com/.netlify/functions/stripe/webhook`
- [ ] Test payment flow end-to-end
- [ ] Verify refund logic
- [ ] Set up payment failure notifications

#### Google OAuth (if using)
- [ ] Production redirect URLs configured
- [ ] OAuth consent screen completed
- [ ] Domain verification completed

#### Google Analytics
- [x] GA4 tracking ID configured (G-D6XDJ31ZX7)
- [ ] Verify GA is tracking in production
- [ ] Set up conversion goals

### 7. Email Notifications
- [ ] Email service configured (if using)
- [ ] Test email templates
- [ ] Verify SMTP credentials (production)
- [ ] Welcome emails work
- [ ] Booking confirmations work
- [ ] Password reset emails work

### 8. Testing

#### Manual Testing (Critical Paths)
- [ ] **User Registration**
  - [ ] Email signup (client)
  - [ ] Email signup (coach)
  - [ ] Google OAuth signup
  - [ ] Email verification flow
- [ ] **Authentication**
  - [ ] Email login
  - [ ] Google login
  - [ ] Logout
  - [ ] Session persistence
- [ ] **Coach Browsing** (Guest)
  - [ ] Browse without login
  - [ ] Filter by sport
  - [ ] Filter by location
  - [ ] Pagination works
  - [ ] View coach profile
- [ ] **Booking Flow** (Client)
  - [ ] Create booking
  - [ ] Payment (Stripe)
  - [ ] View bookings
  - [ ] Cancel booking
  - [ ] Review coach
- [ ] **Coach Dashboard**
  - [ ] View bookings
  - [ ] Accept/decline booking
  - [ ] Set availability
  - [ ] Update profile
  - [ ] Upload media
- [ ] **Messaging**
  - [ ] Send message
  - [ ] Receive message
  - [ ] Message notifications
- [ ] **Admin Dashboard**
  - [ ] View all users
  - [ ] View all bookings
  - [ ] Archive bookings
  - [ ] User management
  - [ ] Deletion requests

#### Cross-Browser Testing
- [ ] Chrome (latest) - Desktop & Mobile
- [ ] Safari (latest) - Mac, iPhone, iPad
- [ ] Firefox (latest) - Desktop
- [ ] Edge (latest) - Desktop

#### Mobile Testing
- [ ] iPhone SE (small screen)
- [ ] iPhone 13/14 (standard)
- [ ] Android phone
- [ ] iPad

### 9. Content & Legal
- [x] Privacy Policy page
- [x] Terms of Service page
- [ ] Review and update privacy policy for GDPR compliance
- [ ] Ensure cookie consent (if using tracking cookies)
- [ ] Contact information visible

### 10. Monitoring & Analytics

#### Error Monitoring
- [ ] Set up error tracking (Sentry, LogRocket, or similar)
- [ ] Configure error alerts
- [ ] Test error reporting

#### Performance Monitoring
- [ ] Google Analytics configured
- [ ] Core Web Vitals tracking
- [ ] Uptime monitoring (e.g., UptimeRobot)

#### Logging
- [ ] Netlify function logs monitored
- [ ] Database query logging (Neon dashboard)
- [ ] Stripe webhook logs reviewed

### 11. Deployment

#### Pre-Deployment
- [ ] Run `npm run build` successfully
- [ ] Test production build locally: `npm run preview`
- [ ] Run `./launch-readiness-check.sh` (should be 100%)
- [ ] Git: All changes committed and pushed
- [ ] Create git tag: `git tag v1.0.0-launch`

#### Netlify Deployment
- [ ] Connect GitHub repo to Netlify
- [ ] Configure build settings:
  - Build command: `npm run build`
  - Publish directory: `dist`
  - Functions directory: `netlify/functions`
- [ ] Set all environment variables in Netlify dashboard
- [ ] Enable automatic deployments from main branch
- [ ] Configure custom domain
- [ ] Enable HTTPS (auto with Netlify)
- [ ] Test deployment URL first
- [ ] Switch to production domain

#### Post-Deployment
- [ ] Test all critical flows on production
- [ ] Verify database connection (production)
- [ ] Verify Stripe webhook receiving events
- [ ] Check Google Analytics receiving data
- [ ] Monitor error logs for 24 hours
- [ ] Test from multiple devices/browsers

### 12. Launch Communication
- [ ] Prepare launch announcement
- [ ] Update social media (if any)
- [ ] Notify initial users/testers
- [ ] Set up customer support channel
- [ ] Prepare FAQ document

## 🎯 Launch Readiness Score

Current Status: **94% Ready** (33/35 tests passing)

### Blocking Issues: 0
No blocking issues! False positives from readiness script (dev server already running).

### Minor Issues: ~50
- 42 `alert()` calls to convert to toasts
- ~10-15 client-side console.logs to clean up (non-blocking)

### Recommended: Convert alerts before launch
Priority order:
1. UserProfile, CoachProfile (5-10 alerts each)
2. MyBookings, CoachDashboard (3-5 alerts each)
3. Admin pages (lower priority)
4. Edge cases and modals (lowest priority)

## 📋 Launch Day Checklist

### Morning of Launch
- [ ] Run final build test
- [ ] Check all environment variables
- [ ] Verify database health
- [ ] Clear any test data
- [ ] Backup database (Neon auto-backup)

### During Launch
- [ ] Deploy to production
- [ ] Verify deployment successful
- [ ] Test critical path: Registration → Booking → Payment
- [ ] Monitor error logs
- [ ] Monitor Netlify function logs
- [ ] Check Stripe dashboard for events

### First Hour After Launch
- [ ] Test from external device (not dev machine)
- [ ] Check Google Analytics receiving traffic
- [ ] Monitor for errors/crashes
- [ ] Be available for immediate fixes

### First 24 Hours
- [ ] Monitor continuously
- [ ] Track user signups
- [ ] Track bookings created
- [ ] Check payment success rate
- [ ] Review error logs
- [ ] Gather user feedback

## 🚨 Rollback Plan

If critical issues arise:
1. Revert to previous deployment in Netlify dashboard
2. Check error logs for root cause
3. Fix locally and test thoroughly
4. Redeploy when fixed

## ✅ Final Sign-Off

- [ ] Technical lead approval: _____________
- [ ] Security review complete: _____________
- [ ] All tests passing: _____________
- [ ] Production environment verified: _____________
- [ ] Monitoring configured: _____________

**Launch Date:** _____________  
**Launched by:** _____________  
**Version:** v1.0.0

---

## 📞 Emergency Contacts

- **Database Issues:** Neon support
- **Payment Issues:** Stripe support  
- **Hosting Issues:** Netlify support
- **Technical Lead:** [Your contact]

## 🎉 Post-Launch

After successful launch:
- [ ] Document lessons learned
- [ ] Plan Phase 3 features
- [ ] Set up regular maintenance schedule
- [ ] Monitor user feedback for improvements
- [ ] Celebrate! 🎊
