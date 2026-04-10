# FACT Migration Guardrails

1. The current Vite web app remains the live production web app until mobile core flows are stable.
2. Expo web is not the immediate replacement target.
3. No repo restructuring occurs before Phase 1 API hardening priorities are addressed.
4. No Expo scaffolding starts before Phase 0 findings are accepted.
5. No production-significant frontend flow may depend on direct DB access once it becomes a mobile target.
6. Shared logic is prioritized over shared UI.
7. Shared UI must be selective; do not force a universal component layer early.
8. Admin remains web-first unless a critical operational need is proven.
9. Backend contracts must remain compatible with the live web app during migration.
10. Any new shared package must preserve current web behavior before mobile consumes it.
11. Auth changes must include compatibility for current web session behavior before improving the model.
12. Payment domain logic stays shared on the backend; payment UI remains platform-specific.
13. Upload authorization stays shared on the backend; upload UX remains platform-specific.
14. No mobile implementation should depend on browser globals such as `window`, `document`, `localStorage`, `sessionStorage`, `window.google`, or DOM canvas APIs.
15. The web app must remain independently buildable and releasable throughout migration.