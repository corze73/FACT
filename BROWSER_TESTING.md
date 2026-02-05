# Cross-Browser Testing Guide - FACT

## 🎯 Test Matrix

| Browser | Desktop | Mobile | Tablet | Priority |
|---------|---------|--------|--------|----------|
| Chrome | ✅ | ✅ | ✅ | **HIGH** |
| Safari | ✅ | ✅ (iOS) | ✅ (iPad) | **HIGH** |
| Firefox | ✅ | ✅ | ✅ | **MEDIUM** |
| Edge | ✅ | ❌ | ❌ | **MEDIUM** |
| Samsung Internet | ❌ | ✅ | ❌ | **LOW** |

## 🧪 Testing Scenarios

### 1. Authentication Flow
Test across all browsers:
- [ ] **Email Registration**
  - Form validation
  - Password visibility toggle
  - Email verification flow
  - Error messages display

- [ ] **Google OAuth**
  - Popup window behavior
  - Redirect handling
  - Session persistence
  - Token storage

- [ ] **Login**
  - Email/password login
  - OAuth login
  - Remember me functionality
  - Logout

### 2. Core User Journeys

#### **Client Journey**
- [ ] Browse coaches without login (guest mode)
- [ ] Filter by sport, location, rating
- [ ] View coach profile
- [ ] Create booking
- [ ] Payment flow (Stripe)
- [ ] View bookings
- [ ] Chat with coach
- [ ] Update profile

#### **Coach Journey**
- [ ] Register as coach
- [ ] Complete coach profile (credentials, rates, availability)
- [ ] View dashboard
- [ ] Manage bookings
- [ ] Chat with clients
- [ ] Update availability
- [ ] View earnings

#### **Admin Journey**
- [ ] Admin dashboard
- [ ] View all users (pagination)
- [ ] View all bookings
- [ ] Archive/restore bookings
- [ ] User management
- [ ] Booking statistics

### 3. UI Component Testing

#### Forms
- [ ] Input fields render correctly
- [ ] Dropdowns/selects work
- [ ] Checkboxes/radio buttons
- [ ] Date pickers
- [ ] File upload (avatar/media)
- [ ] Form validation messages
- [ ] Submit buttons (loading states)

#### Navigation
- [ ] Sidebar menu
- [ ] Mobile hamburger menu
- [ ] Breadcrumbs
- [ ] Links (internal/external)
- [ ] Back button behavior

#### Modals/Dialogs
- [ ] Booking modal
- [ ] Confirmation dialogs
- [ ] Image lightbox
- [ ] Login modal
- [ ] Close behavior (ESC, click outside)

#### Data Display
- [ ] Coach cards (grid layout)
- [ ] Booking cards
- [ ] User cards (admin)
- [ ] Statistics tiles
- [ ] Pagination controls
- [ ] Loading skeletons
- [ ] Empty states

### 4. Browser-Specific Features

#### Chrome (Chromium-based)
- [ ] Service workers (if any)
- [ ] Push notifications API
- [ ] WebRTC (for future video calls)
- [ ] Local storage persistence
- [ ] IndexedDB (if used)

#### Safari (WebKit)
- [ ] **Critical**: CSS Grid compatibility
- [ ] **Critical**: Flexbox gaps
- [ ] Date input fallbacks
- [ ] Touch events on iOS
- [ ] Viewport height (iOS Safari toolbar)
- [ ] localStorage in private mode
- [ ] Cookie behavior (strict ITP)

#### Firefox
- [ ] CSS custom properties
- [ ] Fetch API
- [ ] WebSockets (for real-time)
- [ ] localStorage/sessionStorage
- [ ] Form autofill behavior

#### Edge
- [ ] Modern Chromium version only
- [ ] Windows-specific behaviors
- [ ] Touch screen support (Surface devices)

## 🔍 Known Browser Issues to Check

### Safari-Specific
1. **Flexbox Gap Issue** (iOS < 14.5)
   - Check spacing in card grids
   - Fallback to margins if needed

2. **Date Input** (iOS)
   - Native date picker behavior
   - Format validation

3. **Viewport Height** (iOS Safari)
   - 100vh includes address bar
   - Use `100dvh` or JavaScript fallback

4. **Third-Party Cookies**
   - OAuth redirects
   - Session persistence across redirects

### Firefox-Specific
1. **Scroll Behavior**
   - Smooth scrolling
   - Scroll snap (if used)

2. **File Input**
   - Multiple file selection
   - Accept attribute

### Chrome-Specific
1. **Autofill Styles**
   - Background color override
   - Input field highlighting

## 🛠 Testing Tools

### Browser DevTools
- **Chrome DevTools**: Device emulation, Network throttling
- **Safari Web Inspector**: iOS device debugging
- **Firefox Developer Tools**: Responsive design mode

### Online Testing Services
- **BrowserStack**: Real devices, multiple browsers
- **LambdaTest**: Cross-browser testing
- **Sauce Labs**: Automated browser testing

### Manual Testing
1. **Responsive Design Mode** (in each browser)
   - Test breakpoints: 320px, 375px, 768px, 1024px, 1440px
   - Portrait and landscape orientations

2. **Network Throttling**
   - Fast 3G
   - Slow 3G
   - Offline
   - Check React Query caching behavior

3. **Accessibility Testing**
   - Keyboard navigation (Tab, Enter, ESC)
   - Screen reader (VoiceOver on Mac, NVDA on Windows)
   - Color contrast (DevTools audit)

## ✅ Pre-Launch Checklist

### Must Fix (Blockers)
- [ ] Authentication works in all browsers
- [ ] Payment flow completes successfully
- [ ] No JavaScript errors in console
- [ ] No layout breaking issues
- [ ] Mobile navigation works

### Should Fix (Important)
- [ ] Touch targets are 44x44px minimum
- [ ] Forms validate consistently
- [ ] Toast notifications display properly
- [ ] Loading states show correctly
- [ ] Error messages are clear

### Nice to Have
- [ ] Smooth animations across browsers
- [ ] Consistent font rendering
- [ ] Hover states work on touch devices
- [ ] Print styles (if needed)

## 🐛 Common Issues & Fixes

### Issue: OAuth popup blocked
**Fix**: Use redirect flow instead of popup on mobile browsers

### Issue: 100vh too tall on iOS Safari
**Fix**: Use `100dvh` (dynamic viewport height) or JavaScript calculation

### Issue: Flexbox gap not working (Safari < 14.5)
**Fix**: Use margin-based spacing or update target iOS version

### Issue: Third-party cookies blocked
**Fix**: Use SameSite=None; Secure in production, first-party domain for API

### Issue: Date picker inconsistent
**Fix**: Use a library like react-datepicker for consistent UX

### Issue: Form autofill styling
**Fix**: Override with custom styles:
```css
input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 1000px white inset;
  -webkit-text-fill-color: black;
}
```

## 📊 Testing Progress Template

```markdown
## Browser Testing Results

### Chrome (Latest)
- Desktop: ✅ PASS
- Mobile (Android): ✅ PASS
- Issues: None

### Safari (Latest)
- Desktop: ✅ PASS
- iOS (iPhone): ⚠️ WARNING - Viewport height issue
- iPad: ✅ PASS
- Issues: 100vh includes toolbar, need to fix

### Firefox (Latest)
- Desktop: ✅ PASS
- Mobile: ✅ PASS
- Issues: None

### Edge (Latest)
- Desktop: ✅ PASS
- Issues: None
```

## 🚀 Automated Testing (Future)

Consider adding:
1. **Playwright** - Cross-browser E2E testing
2. **Cypress** - Component and E2E testing
3. **Vitest** - Unit testing (already in package.json)
4. **React Testing Library** - Component testing

## 📝 Testing Commands

```bash
# Start dev server
npm run dev

# Run on different ports for simultaneous testing
PORT=3000 npm run dev

# Build for production testing
npm run build
npm run preview

# Test production build locally
netlify dev --prod
```

## ✅ Sign-Off

Once all browsers tested:
- [ ] Chrome ✅
- [ ] Safari ✅
- [ ] Firefox ✅
- [ ] Edge ✅
- [ ] Mobile Chrome ✅
- [ ] Mobile Safari ✅

**Tested by:** _____________  
**Date:** _____________  
**Issues found:** _____________  
**Ready for production:** ☐ Yes ☐ No
