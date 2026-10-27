# Step 10 — Hardening and Demo Data

- [x] Audit every server function, live RLS policy and route; document and fix gaps.
- [x] Show SQL and policy explanations before applying database changes.
- [x] Add atomic, idempotent owner-only demo loading and demo-only removal.
- [x] Review page states and add friendly global error and not-found handling.
- [x] Run permission regressions and signed-in demo load/reload/remove checks.
- [x] Document changed files, decisions and three-role test checklist; disclose member/stakeholder session limits.

# UAT — Shared role access

- [x] Present foundational SQL, policy explanations and secure session approach for approval.
- [x] Resolve direct account email/password-change protection: user approved server-held sessions and opaque protected cookies.
- [ ] Integrate cookie-only demo sessions with the protected-route gate. Blocked: managed gate requires browser Cloud Auth, and current platform rules prohibit replacing it.
- [ ] Add off-by-default controls, account provisioning, rate-limited role picker and request-time kill switch.
- [ ] Enforce demo restrictions in server checks and database policies; add shared-role banner and audit labels.
- [ ] Verify role logins, revocation, restricted actions and unchanged real sign-in; provide testing checklist.

UAT is not implemented or enabled. No schema changes or demo accounts have been applied. Complete security SQL still requires review before application. Real sign-in and project data remain unchanged.