# FACT Phase 0 Audit

## Scope

Phase 0 is audit-only. No repo restructuring, Expo scaffolding, or production logic rewrites are included.

## Assumptions

- The current Vite app remains the live production web app throughout migration.
- Expo web is not the immediate replacement target.
- Findings are based on the currently checked-out `main` branch workspace state.
- `src/api/entities.jsx` is the active frontend entity layer; `src/api/entities-backup.jsx` is legacy but still present and therefore included as technical debt.
- Netlify functions are the intended shared backend surface, even where current frontend code still falls back to direct DB access.

## Inspected Files And Folders

- `package.json`
- `netlify.toml`
- `src/`
- `src/main.jsx`
- `src/App.jsx`
- `src/pages/index.jsx`
- `src/pages/Layout.jsx`
- `src/pages/Landing.jsx`
- `src/pages/Register.jsx`
- `src/pages/FindCoaches.jsx`
- `src/pages/MyBookings.jsx`
- `src/pages/CoachDashboard.jsx`
- `src/pages/UserProfile.jsx`
- `src/pages/CoachProfile.jsx`
- `src/pages/Messages.jsx`
- `src/pages/Conversation.jsx`
- `src/pages/AdminDashboard.jsx`
- `src/pages/AdminUsers.jsx`
- `src/pages/AdminBookings.jsx`
- `src/pages/AdminVerifications.jsx`
- `src/pages/AdminAuditLogs.jsx`
- `src/pages/AdminOperations.jsx`
- `src/pages/AdminInvite.jsx`
- `src/pages/ForgotPassword.jsx`
- `src/pages/ResetPassword.jsx`
- `src/pages/Help.jsx`
- `src/pages/PrivacyPolicy.jsx`
- `src/pages/Terms.jsx`
- `src/api/apiClient.js`
- `src/api/entities.jsx`
- `src/api/databaseClient.js`
- `src/api/authLogger.js`
- `src/api/emailService.js`
- `src/api/payment-automation.js`
- `src/api/stripe-payment.js`
- `src/components/booking/BookingModal.jsx`
- `src/components/payment/StripePaymentModal.jsx`
- `src/components/coaches/AvailabilityCalendar.jsx`
- `src/components/admin/SidebarBookingSearch.jsx`
- `netlify/functions/users.js`
- `netlify/functions/stripe.js`
- `netlify/functions/uploads.js`
- `netlify/functions/lib/auth.js`

## 1. Route Inventory

| Route / Path | Purpose | Auth Required | Role Required | Public / Protected | Web-only / Mobile-candidate | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/`, `/landing`, `/Landing` | Marketing landing, login entry, post-auth redirect handler | No | None | Public | Web-first, mobile-candidate for equivalent native entry | Uses `next=dashboard` query callback flow and cached browser session data. |
| `/register`, `/Register` | Email or Google signup for client/coach | No | None | Public | Mobile-candidate | Uses `?type=coach|client`, `sessionStorage`, browser file inputs, and OAuth redirect assumptions. |
| `/findcoaches`, `/FindCoaches` | Browse/search coaches and start booking | No for browsing; yes for booking | Non-admin for normal use | Mixed public/protected | Mobile-candidate | Guests can browse; booking flow requires authenticated non-admin user. Admins are redirected to admin dashboard. |
| `/mybookings`, `/MyBookings` | Client booking list, reviews, conversation entry | Yes | Authenticated non-admin user | Protected | Mobile-candidate | Redirects unauthenticated users to landing; admins redirected away. Contains review submission flow. |
| `/coachdashboard`, `/CoachDashboard` | Coach booking management dashboard | Yes | Coach | Protected | Mobile-candidate | Loaded from authenticated user context; not explicitly hard-blocked in router, but behavior is coach-oriented. |
| `/userprofile`, `/UserProfile` | End-user profile and password/account actions | Yes | Authenticated user, or admin viewing with `?userId=` | Protected | Mobile-candidate | Admin without `userId` gets redirected to admin dashboard. Uses query params and browser image upload flow. |
| `/coachprofile`, `/CoachProfile` | Coach profile editing or profile viewing | Yes for current implementation | Coach or admin; other authenticated viewers may read another profile via `?userId=` | Protected | Mobile-candidate | Current implementation always calls `User.me()` first, so this is not guest-accessible despite being a profile page. Includes availability and compliance upload flows. |
| `/messages`, `/Messages` | Conversation list for booking and direct threads | Yes | Authenticated user or admin | Protected | Mobile-candidate | Admin sees platform-wide booking and direct threads. |
| `/conversation`, `/Conversation` | Individual conversation view | Yes | Authenticated user or admin with valid booking/direct context | Protected | Mobile-candidate | Uses query params such as `booking_id`; browser history fallback is web-coupled. |
| `/admindashboard`, `/AdminDashboard` | Admin overview dashboard | Yes | Admin | Protected | Web-first | Redirects non-admin users away; desktop/admin dense surface. |
| `/adminusers`, `/AdminUsers` | Admin user management | Yes | Admin | Protected | Web-only for now | Uses `?type=` and admin-only management controls. |
| `/adminbookings`, `/AdminBookings` | Admin booking management and payment collection | Yes | Admin | Protected | Web-only for now | Includes current Stripe web payment modal and query-param highlight behavior. |
| `/adminverifications`, `/AdminVerifications` | Admin coach compliance verification queue | Yes | Admin | Protected | Web-only for now | Compliance review is desktop/admin-oriented and links out to uploaded documents. |
| `/adminauditlogs`, `/AdminAuditLogs` | Audit log viewing/export | Yes | Admin | Protected | Web-only | Dense operational screen with export behavior. |
| `/adminoperations`, `/AdminOperations` | Admin operations tooling, disputes, auth logs, admin roles | Yes | Admin | Protected | Web-only | Broad operational surface; should remain web-first. |
| `/admininvite`, `/AdminInvite` | Admin invite accept flow | No initial auth; establishes session on accept | Invite token holder | Public token-gated | Web-first now, mobile-later if needed | Uses `?token=` query param and becomes authenticated on success. |
| `/forgotpassword`, `/ForgotPassword` | Request password reset email | No | None | Public | Mobile-candidate | Standard public auth recovery screen. |
| `/resetpassword`, `/ResetPassword` | Complete password reset from email token | No initial auth | Reset token holder | Public token-gated | Mobile-candidate | Uses `?token=` query param, auto-signs user in after success. |
| `/help`, `/Help` | FAQ/help content and admin FAQ management | Mixed | Public for reading; admin for content management | Mixed public/protected-admin capabilities | Web-first, selective mobile-candidate | Current page includes web analytics, import/export, localStorage analytics fallback, and admin CRUD in one screen. |
| `/privacypolicy`, `/PrivacyPolicy` | Privacy page | No | None | Public | Web-only | Static legal content. |
| `/terms`, `/Terms` | Terms page | No | None | Public | Web-only | Static legal content. |
| `/datadiagnostic`, `/DataDiagnostic` | Internal diagnostic page | Unclear, should be treated as internal | Internal/admin | Internal | Web-only | Not a user-facing product route; should remain non-mobile and likely internal-only. |

## 2. Auth Flow Inventory

### Email Sign-up

1. User opens `/register` and selects email signup.
2. Form state is held entirely in browser React state.
3. For coaches, optional qualification/background files are validated client-side before upload.
4. `User.signUpWithEmail()` in `src/api/entities.jsx` calls `apiClient.createUser()` with `auth_mode: 'signup'`.
5. `netlify/functions/users.js` validates password, creates user/profile if needed, and signs a backend JWT with `signAuthToken()`.
6. Frontend stores the returned token and user metadata via `auth.setCurrentUser()` in `src/api/databaseClient.js`.
7. For coach signup, frontend then uploads compliance files through `/uploads` and patches compliance via `/profile/compliance`.
8. User is redirected back to landing.

Browser-only assumptions:

- Browser form/file handling.
- `localStorage` token/session persistence.
- Browser redirect navigation after signup.

Mobile blockers:

- No storage abstraction beyond browser storage.
- Coach compliance file handling depends on browser `File` objects and `input type="file"`.
- Signup side effects still dynamically import browser-side auth/email logging modules with DB coupling.

### Email Sign-in

1. User opens login modal on landing.
2. Modal calls `User.signInWithEmail()`.
3. Frontend posts to `/users` with `auth_mode: 'signin'`.
4. Backend verifies password hash in `netlify/functions/users.js`.
5. Backend returns signed JWT and profile payload.
6. Frontend stores token and user metadata via `auth.setCurrentUser()`.
7. Landing hard-redirects to `/landing?next=dashboard`.
8. Landing then calls `User.me()` and redirects by role.

Browser-only assumptions:

- Hard navigation through `window.location.href`.
- `localStorage`-based token restore.

Mobile blockers:

- Redirect orchestration is page-driven rather than auth-state-driven.
- No refresh-token support.

### Google OAuth Sign-in / Sign-up

1. User clicks Google login on landing or Google signup on register.
2. Frontend calls `User.loginWithRedirect()`.
3. `User.login()` uses `window.google.accounts.oauth2.initTokenClient()`.
4. Browser Google SDK returns an access token.
5. Frontend fetches Google user info directly from `https://www.googleapis.com/oauth2/v3/userinfo`.
6. Frontend sends profile data to `/users` with OAuth semantics.
7. Backend creates or updates the FACT profile and returns a FACT JWT.
8. Frontend stores token in browser storage and hard-navigates to the landing callback route.
9. Landing rehydrates profile and applies any `pendingProfileData` from `sessionStorage`.

Browser-only assumptions:

- `window.google` Google Identity Services.
- `window.location.origin` callback construction.
- `sessionStorage` for `authRedirect` and `pendingProfileData`.

Mobile blockers:

- Entire OAuth flow is browser-GIS-specific.
- Provider callback handling is not designed around native deep linking.
- Pending signup data assumes browser storage continuity.

### Password Reset Request

1. User opens `/forgotpassword`.
2. Frontend calls `User.forgotPassword()`.
3. `apiClient` posts to `/users/forgot-password`.
4. Backend generates a reset token hash, stores it in `users`, and sends email.
5. Backend always returns success to avoid email enumeration.

Browser-only assumptions:

- None that are fundamental beyond the current web UI.

Mobile blockers:

- None in backend flow; only screen/UI needs native replacement.

### Password Reset Completion

1. User opens `/resetpassword?token=...`.
2. Frontend reads token from `window.location.search`.
3. Frontend posts `{ token, newPassword }` to `/users/reset-password`.
4. Backend validates token hash and expiry.
5. Backend sets new password, clears reset token, revokes prior sessions via `token_revoked_at`, and signs a new JWT.
6. Frontend stores returned token/user and auto-signs user in.
7. Frontend redirects to `/landing?next=dashboard`.

Browser-only assumptions:

- Query-param token parsing.
- Browser redirect after success.

Mobile blockers:

- Reset completion assumes web URL callback rather than app deep link or native screen state.

### Logout

1. User clicks logout in layout.
2. `User.logout()` delegates to `auth.signOut()` in `src/api/databaseClient.js`.
3. Frontend clears `currentUser` and `authToken` from `localStorage`.
4. Layout redirects to landing using `window.location.href`.

Browser-only assumptions:

- Local-only logout semantics.
- Browser storage clearing.
- Hard redirect.

Mobile blockers:

- No server-side refresh-token/session revocation model.
- No storage abstraction.

### Session Restore

1. `src/main.jsx` calls `auth.init()` at app boot.
2. `auth.init()` reads `currentUser` from `localStorage`.
3. If running in dev with direct DB enabled, it also sets DB RLS context in the browser helper.
4. Layout later calls `User.isAuthenticated()` and `User.me()` to load current user.
5. Landing also reads cached user/session data directly during callback routing.

Browser-only assumptions:

- `localStorage` as the single persistence mechanism.
- Boot behavior spread across `main.jsx`, layout, and landing.

Mobile blockers:

- No centralized session bootstrap abstraction.
- Session persistence is not designed for SecureStore or native resume behavior.

### Token Refresh

Current state:

- No refresh-token flow is present.
- No `/refresh` endpoint is present.
- Access token rotation is only done on password change/reset where a new JWT is returned.
- Session invalidation today is based on `profiles.token_revoked_at` checks in `netlify/functions/lib/auth.js`.

Browser-only assumptions:

- Long-lived access token stored in browser storage.

Mobile blockers:

- Native apps need an explicit refresh strategy and secure persistence model.
- Current model is insufficient for robust long-lived mobile sessions.

## 3. Payments Flow Inventory

| Flow | Frontend Entry Point | Backend Endpoint / Function | Stripe Dependency | Booking State Impact | Web-only Assumptions | Native Replacement Required |
| --- | --- | --- | --- | --- | --- | --- |
| Booking request creation | `src/components/booking/BookingModal.jsx` | `POST /bookings` via Netlify bookings function | None at request time; UI only references Stripe conceptually | Creates pending booking with pricing fields | Pure web modal UI today, but not Stripe-bound | Native booking sheet/form only; backend contract reusable |
| Admin payment collection | `src/pages/AdminBookings.jsx` -> `src/components/payment/StripePaymentModal.jsx` | `POST /.netlify/functions/stripe/create-payment-intent`, `POST /.netlify/functions/stripe/confirm-payment` | `@stripe/stripe-js`, `@stripe/react-stripe-js`, CardElement | On success, marks booking `confirmed` and `payment_status = authorized` | CardElement, Stripe.js, browser fetch fallback URLs, modal UX | Yes, replace with Stripe React Native / PaymentSheet flow |
| Stripe webhook success | No direct frontend entry | `netlify/functions/stripe.js` webhook route | Stripe webhook signature verification | Confirms booking and payment authorization server-side | None | No client replacement; shared backend logic |
| Stripe webhook failure | No direct frontend entry | `netlify/functions/stripe.js` webhook route | Stripe webhook | Sets booking `payment_failed`, payment status `failed` | None | No client replacement; shared backend logic |
| Manual payment capture | No current web UI found in active app | `POST /stripe/capture-payment` in `netlify/functions/stripe.js` | Stripe PaymentIntent capture | Updates payment status to `captured` | No active UI, but web/server tooling exists | Possibly later admin web enhancement only |
| Refund processing | No current active frontend entry found | `POST /stripe/refund-payment` in `netlify/functions/stripe.js` | Stripe refund API | Updates payment refund fields/status | No active UI in current end-user app | Likely admin web-first only |
| Legacy Express Stripe routes | `server.js` / `src/api/stripe-routes.js` dev/server path | Express routes mirroring Stripe operations | Stripe server SDK | Mirrors backend payment actions | Not part of current Netlify-first production path | Do not port; treat as legacy/dev debt |

## 4. Uploads / Media Flow Inventory

| Feature | File Type | Frontend Handling | Backend Handling | Browser-only Dependency | Native Replacement Required |
| --- | --- | --- | --- | --- | --- |
| Coach signup qualification upload | PDF, JPG, JPEG, PNG | `src/pages/Register.jsx` validates browser `File`, builds `FormData`, uploads before compliance patch | `netlify/functions/uploads.js` parses multipart with Busboy, stores via `uploadBuffer()` | `input type="file"`, browser `File`, `FormData` | Yes, native document picker + multipart upload |
| Coach signup background-check upload | PDF, JPG, JPEG, PNG | Same as above in `src/pages/Register.jsx` | Same `/uploads` function | Same browser file handling | Yes |
| Coach profile qualification re-upload | PDF, JPG, JPEG, PNG | `src/pages/CoachProfile.jsx` file input + `User.uploadComplianceFile()` | Same `/uploads` function | Browser file input | Yes |
| Coach profile background-check re-upload | PDF, JPG, JPEG, PNG | `src/pages/CoachProfile.jsx` file input + `User.uploadComplianceFile()` | Same `/uploads` function | Browser file input | Yes |
| User profile avatar update | Image files | `src/pages/UserProfile.jsx` uses `FileReader`, `Image`, `canvas`, `toDataURL()` to generate base64 avatar | Saved via existing profile update route as `avatar_url` | `FileReader`, DOM canvas, browser image decoding | Yes, native image picker + image manipulation |
| Coach profile avatar update | Image files | `src/pages/CoachProfile.jsx` uses `FileReader`, `Image`, `canvas`, `toDataURL()` | Saved via existing profile update route as `avatar_url` | `FileReader`, DOM canvas, browser image decoding | Yes |
| Admin verification document review | Existing uploaded file URLs | Links to uploaded files from admin verification screen | Backend simply serves stored URLs from storage provider | Browser anchor/open-in-tab pattern | No upload replacement; only native document viewer if ever needed |
| Help FAQ import | JSON file | `src/pages/Help.jsx` file input/import flow | Help-content endpoints ingest parsed data | Browser file input | Not needed for mobile; keep web-only |
| Coach video clips | URL strings, not uploaded files | `src/pages/CoachProfile.jsx` stores external video URLs | Profile update only | Browser embed preview behavior | Optional native link/embed handling later |

## 5. Frontend Direct-to-Database Dependency Register

| File Path | Feature | Severity | Why It Blocks Mobile | Recommended Replacement Path |
| --- | --- | --- | --- | --- |
| `src/api/databaseClient.js` | Browser-side Neon client and auth persistence helper | Critical | Mobile cannot use direct browser DB helpers; current auth/session model is coupled to this module | Replace with shared auth/session package and keep DB access server-only |
| `src/main.jsx` | App boot calls `auth.init()` from browser DB/auth helper | Critical | Mobile bootstrap cannot depend on browser auth init | Move boot/session restore into shared auth runtime with web/mobile storage adapters |
| `src/api/entities.jsx` | User `me/list/get/filter/update` API fallbacks to direct DB | Critical | Mobile-critical user flows can fall through to direct DB behavior | Remove all production fallbacks and require API-only user operations |
| `src/api/entities.jsx` | Booking `list/get/filter/create/update/delete` API fallbacks to direct DB | Critical | Booking is core mobile functionality; direct DB fallback is not portable | Finish bookings API contract and remove DB fallback |
| `src/api/entities.jsx` | Message `filter/create/update/delete/clearConversation` API fallbacks to direct DB | Critical | Messaging is core mobile functionality and cannot depend on browser DB helper | Keep messages API-only and remove DB fallback |
| `src/api/entities.jsx` | `Review` entity is direct DB only | Critical | Reviews are used by active web flow and have no API path | Add reviews API endpoints and switch consumers |
| `src/pages/MyBookings.jsx` | Calls `Review.create()` | Critical | Active review submission depends on direct DB-only entity | Replace with review endpoint through shared API package |
| `src/api/entities.jsx` | `CoachAvailability` entity is direct DB only | Critical | Availability is a coach/mobile-critical feature with no API path | Add availability endpoints and remove direct DB path |
| `src/api/entities.jsx` | `CoachRecurringAvailability` entity is direct DB only | Critical | Recurring availability remains web-only if not API-backed | Add recurring availability endpoints |
| `src/components/coaches/AvailabilityCalendar.jsx` | Uses `CoachAvailability.*` direct DB entity | Critical | Active coach profile flow cannot move to mobile cleanly | Repoint calendar to API-backed availability service |
| `src/api/entities.jsx` | `Payment` entity is direct DB only | Medium | Current main payment collection uses Stripe function endpoints, but any client-side payment entity usage would be non-portable | Keep payment writes server-side and expose read APIs if needed |
| `src/api/entities.jsx` | `SessionDispute` entity is direct DB only | Medium | Admin/ops and future mobile support flows cannot share this cleanly | Add dispute API endpoints or keep strictly admin web-only |
| `src/api/authLogger.js` | Browser-side auth logging writes directly to DB | Medium | Dynamically imported during sign-in/sign-up side effects; not portable and architecturally wrong for mobile | Move auth logging fully server-side inside auth endpoints |
| `src/api/emailService.js` | Browser-side email logging writes directly to DB | Medium | Client should not own email-log DB writes; browser-only and unsafe for shared mobile logic | Move email logging and delivery server-side only |
| `src/api/entities-backup.jsx` | Legacy full direct-DB entity layer | Low | Not the active app path, but increases confusion and migration risk | Archive or remove after Phase 1 confirms no runtime dependency |
| `src/api/payment-automation.js` | Frontend-tree module imports DB directly for payment automation | Low | Not part of mobile app path, but pollutes frontend tree with server behavior | Move to server/scripts or backend-only package later |
| `src/api/email-routes.js` | Frontend-tree route helper writes email logs via DB | Low | Non-portable server-like code inside frontend source tree | Move to backend-only area later |
| `src/api/stripe-payment.js` | Frontend-tree Stripe helper imports Netlify DB helper directly | Low | Blurs frontend/backend boundary and complicates package extraction | Keep Stripe server logic only under backend surface |

## 6. Browser-only Dependency Register

| File Path | Dependency / API | Category | Disposition |
| --- | --- | --- | --- |
| `src/main.jsx` | `window`, `URLSearchParams(window.location.search)`, `sessionStorage`, `window.addEventListener` | Boot/runtime globals | Replace with adapter for shared boot logic; keep monitoring bootstrap web-specific |
| `src/api/apiClient.js` | `localStorage`, `window.location.href`, `FormData` | Session storage and browser navigation | Replace with storage + navigation adapters; keep raw `FormData` support abstracted |
| `src/api/databaseClient.js` | `localStorage`, browser Neon usage | Session persistence and dev-only DB access | Replace for shared auth; keep direct DB dev-only and web-only |
| `src/api/entities.jsx` | `window.google`, `navigator.userAgent`, `sessionStorage`, `window.location.href`, fetch to Google userinfo | OAuth/browser auth APIs | Rewrite for mobile auth; keep web adapter for browser GIS |
| `src/pages/Landing.jsx` | `window.location`, `localStorage`, `sessionStorage`, `window.history.replaceState` | Auth callback and browser session handling | Replace with shared auth callback orchestration; web adapter only |
| `src/pages/Register.jsx` | `window.location.search`, `sessionStorage`, `input type="file"` | Route params, pending signup storage, file upload | Rewrite for native; keep web implementation |
| `src/pages/ResetPassword.jsx` | `window.location.search`, `window.history.length` | Token route parsing and back nav | Replace with router/deep-link adapter |
| `src/pages/AdminInvite.jsx` | `window.location.search`, `window.history.length` | Token route parsing and back nav | Replace with router/deep-link adapter if ever needed on mobile; otherwise keep web-first |
| `src/pages/CoachProfile.jsx` | `URLSearchParams(window.location.search)`, `FileReader`, `Image`, DOM `canvas`, file inputs, `window.history` | Profile media handling and route parsing | Rewrite for native media stack |
| `src/pages/UserProfile.jsx` | `URLSearchParams(window.location.search)`, `FileReader`, `Image`, DOM `canvas`, file input, `window.history` | Profile media handling and route parsing | Rewrite for native media stack |
| `src/pages/Layout.jsx` | `window.location.href`, `window.location.origin` | Logout/login redirect handling | Replace with shared auth/navigation adapter |
| `src/pages/Help.jsx` | `window.gtag`, `localStorage`, `window.confirm`, DOM anchor creation, file input | Analytics/import-export/admin tooling | Keep web-only for now |
| `src/pages/Terms.jsx` | `window.history.length` | Back navigation | Replace with router abstraction later or keep web-only |
| `src/pages/PrivacyPolicy.jsx` | `window.history.length` | Back navigation | Keep web-only |
| `src/pages/AdminUsers.jsx` | `URLSearchParams(window.location.search)`, `window.history.length` | Admin routing behavior | Keep web-only |
| `src/pages/AdminBookings.jsx` | `URLSearchParams(window.location.search)`, `window.history.length` | Admin routing behavior | Keep web-only |
| `src/pages/AdminVerifications.jsx` | `window.history.length` | Admin navigation | Keep web-only |
| `src/pages/AdminAuditLogs.jsx` | `window.history.length` | Admin navigation/export context | Keep web-only |
| `src/pages/AdminOperations.jsx` | `window.history.length` | Admin navigation | Keep web-only |
| `src/pages/Conversation.jsx` | `URLSearchParams(window.location.search)`, `window.history.length` | Conversation route parsing | Replace with router/deep-link adapter |
| `src/components/payment/StripePaymentModal.jsx` | `@stripe/stripe-js`, `@stripe/react-stripe-js`, `CardElement` | Web payment SDK | Rewrite for native payment UX |
| `src/components/admin/SidebarBookingSearch.jsx` | `window.location.href` | Imperative browser navigation | Replace with router/navigation adapter |
| `src/api/authLogger.js` | `navigator.userAgent` | Browser diagnostics | Replace with server-side auth/event logging |

## 7. Migration Guardrails

See `docs/architecture/migration-guardrails.md`.

## 8. Phase 1 Priority List

1. Remove mobile-blocking direct DB paths from active user, booking, and message flows in `src/api/entities.jsx`.
2. Build API endpoints for reviews and switch `src/pages/MyBookings.jsx` off `Review.create()`.
3. Build API endpoints for coach availability and recurring availability, then replace `src/components/coaches/AvailabilityCalendar.jsx` usage.
4. Move all auth logging and email side effects fully server-side; stop importing browser-side DB logging modules from auth flows.
5. Introduce a shared auth/session abstraction so boot, restore, login, logout, and callback handling are not spread across `main.jsx`, `Landing.jsx`, `Layout.jsx`, and `databaseClient.js`.
6. Define the future refresh-token/session strategy, because current auth has no refresh flow.
7. Isolate all browser-only route/query/history handling behind adapters so mobile can own deep-link parsing.
8. Isolate media handling behind upload/image abstractions, starting with profile avatars and compliance uploads.
9. Keep admin surfaces web-first; do not spend Phase 1 effort porting admin UX to mobile.
10. After API hardening is complete, only then start the monorepo extraction and shared package move.