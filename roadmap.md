# Step 10 — Hardening and Demo Data

- [x] Audit every server function, live RLS policy and route; document and fix gaps.
- [x] Show SQL and policy explanations before applying database changes.
- [x] Add atomic, idempotent owner-only demo loading and demo-only removal.
- [x] Review page states and add friendly global error and not-found handling.
- [x] Run permission regressions and signed-in demo load/reload/remove checks.
- [x] Document changed files, decisions and three-role test checklist; disclose member/stakeholder session limits.

# UAT — Shared role access (self-healing)

- [x] Off-by-default Settings → Test access for real owners: set up accounts, on/off, expiry, feedback link.
- [x] Sign-in role picker with one-time sign-in; account email/password reset on every login; 5 attempts/min per IP.
- [x] Kill switch in every database permission check; banner with role switching, feedback and exit.
- [x] Shared accounts blocked from team, invitations, demo data, project name/code, profile and new projects.
- [x] Verified owner setup, tester sign-in, role switch and switch-off sign-out in the browser.
