# User guide

- [ ] Add detailed, accurate guides for owners, members and stakeholders.
- [ ] Link the public guide from the home screen and signed-in navigation.
- [ ] Verify role selection, reading navigation and narrow-screen layout.

# Step 10 — Hardening and Demo Data
# Multi-project support

- [x] Add secure active-project selection with cleanup and invitation acceptance across projects.
- [x] Add sidebar switcher and new-project modal; preserve project-specific roles and UAT isolation.
- [x] Run regressions and signed-in create/switch/isolation checks; document SQL and role checklist.


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
