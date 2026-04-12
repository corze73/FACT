# Mobile Real-Device Readiness (2026-04-12)

## Current status

- Simulator release builds: PASS
- Simulator install + launch: PASS
- Physical device build target (`generic/platform=iOS`): FAIL (signing only)

## Evidence from checks

- Xcode toolchain: `Xcode 26.4 (17E192)`
- Active developer path: `/Applications/Xcode.app/Contents/Developer`
- iOS bundle id: `com.findacoachtoday.mobile`
- Physical iPhone detected: `C's Phone (18.6.2)` (offline during check)
- Blocking error:
  - `Signing for "FACTMobile" requires a development team.`

## What is already production-like

- Mobile API base points to production Netlify Functions:
  - `https://findacoachtoday.com/.netlify/functions`
- Auth/session and API calls are wired and functioning in release simulator runs.
- Core admin + coach operation paths compile and launch in release builds.

## Gaps before real-device testing

1. iOS signing is not configured (`DEVELOPMENT_TEAM` missing in Xcode target).
2. The physical device was listed as offline during the check.
3. No scripted `ios:release` npm command existed (now added).

## Immediate unblock steps (iOS physical device)

1. Open `apps/mobile/ios/FACTMobile.xcworkspace` in Xcode.
2. Select target `FACTMobile` -> `Signing & Capabilities`.
3. Enable `Automatically manage signing`.
4. Select your Apple Team for both Debug and Release.
5. Plug in iPhone, unlock it, and trust this Mac.
6. Ensure Developer Mode is enabled on the iPhone.
7. Build for device once from Xcode, then verify CLI build:

```bash
cd apps/mobile/ios
xcodebuild -workspace FACTMobile.xcworkspace \
  -scheme FACTMobile \
  -configuration Release \
  -destination 'generic/platform=iOS' build
```

## Suggested smoke test sequence on real device

1. Sign in with coach account.
2. Open Coach Operations:
   - Edit profile, save.
   - Upload qualification/background documents.
   - Add/edit recurring availability.
3. Sign in with admin account.
4. Open Admin Operations:
   - Verify a coach (approve/reject/pending + notes).
   - Update a case and dispute.
   - Test new filters and load-more controls.
5. Confirm updates persist after app restart.

## Confidence estimate

- Internal iOS real-device smoke readiness after signing fix: high (same day)
- Cross-platform (iOS + Android) pilot: moderate (2-4 days with full regression
  pass)
