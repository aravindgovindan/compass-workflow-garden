# Compass Workflow — UAT access status

## Approved scope

Shared Owner, Member and Stakeholder logins, off by default, expiry, real-owner control panel, persistent UAT banner, audit attribution, demo-data reset and request-time kill switch.

The user also approved opaque protected-cookie demo sessions and a custom database-backed limit of five login attempts per minute per IP.

## Security findings

An ordinary Cloud Auth session gives its holder access to the authentication service's account-update endpoint. App server checks and public-table policies cannot block that endpoint. Keeping a random password secret, or issuing a passwordless session, does not remove this ability.

The secure approach is to retain all demo Cloud Auth tokens on the server and give the browser only an opaque HttpOnly cookie. Ordinary demo data operations must still run as the demo identity so row-level permissions apply. This must not be a generic authentication proxy.

## Current blocker

The existing protected-route gate in `src/routes/_authenticated/route.tsx` first calls browser `supabase.auth.getUser()`. Cookie-only demo users have no browser Cloud Auth session, so that gate redirects them to `/login` before demo session context can load. The generated server middleware also requires a bearer token.

Current platform integration guidance prohibits rewriting the integration-managed gate. A supported separate authentication-owner gate is required before these same protected screens can accept cookie-only UAT sessions. A browser Auth token workaround is not acceptable because it defeats the credential-change safeguard.

No schema migration was applied, no demo accounts were created, no shared-session endpoint was exposed, and no app authentication code was changed. Existing sign-in and project data remain unchanged. UAT must stay unavailable until this is resolved.

## Remaining implementation

1. Establish supported route and server middleware composition for real bearer sessions and opaque-cookie demo sessions.
2. Present complete security SQL for review: private account/session mapping, configuration, durable counters, all four membership helpers, self-profile exceptions, real-owner membership/invitation checks, core-project protections, last-real-owner integrity and audit functions.
3. Verify server-side passwordless issuance against hosted authentication using disposable accounts. Never log links, OTPs or tokens. Use existing privileged credentials; determine encrypted session storage before requesting any additional secret.
4. Implement the real-owner panel, public enabled-only availability, rate-limited role picker, request-time session rejection, banner and shared audit labels.
5. Run authenticated browser checks for all three demo roles, disable/expiry revocation, restricted actions, real-owner regression and direct API safeguards.

## Future test checklist — not available yet

- Real Owner opens Settings → UAT Access, creates the three accounts and optionally resets manifest-tracked demo data.
- Set a short expiry and optional HTTPS feedback URL, then enable UAT.
- Open `/login` in a separate browser and enter each shared role; verify section and write permissions.
- Confirm credential material is absent from page scripts, storage and response bodies; only the protected opaque session cookie is present.
- Disable UAT and verify each open demo session is rejected on its next request; repeat for expiry.
- Verify real-account sign-in and Google sign-in remain unaffected.

## Changes in this task

- Foundational review draft: `.lovable/uat-access-migration.sql` (not applied; incomplete by itself).
- Approved implementation plan archived under `.lovable/plan/`.
- Shared UAT requirement memory, architecture rule, roadmap and this status document.

No application or database behavior changes have shipped.