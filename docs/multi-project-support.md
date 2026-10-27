# Multi-project support — Compass Workflow

## Delivered
- Sidebar project switcher showing name, code, role and health.
- New-project modal; first-run setup continues using the existing wizard.
- Persisted active project with server-side membership checks and deterministic fallback.
- Atomic project creation with owner membership, default configuration, selection and existing audit triggers.
- Verified-email invitations can add memberships to additional projects without replacing active roles.
- UAT role switching is pinned to the selected test project; real owners can enable test access independently per project.

## Files changed
- `src/functions/project.functions.ts`, `session.functions.ts`, `config.functions.ts`, `uat.functions.ts`
- `src/lib/project-access.server.ts`
- `src/lib/projects/selection.ts`, `selection.test.ts`, `use-project-mutation.ts`
- `src/components/layout/project-switcher.tsx`, `app-shell.tsx`
- `src/components/project/create-project-dialog.tsx`
- `src/components/uat/uat-banner.tsx`, `uat-picker.tsx`
- `src/lib/auth/guard.test.ts`, `server-access.test.ts`
- `src/test/projects.integration.test.ts`
- `src/routes/index.tsx`, generated Cloud types, `README.md`, `AGENTS.md`, `roadmap.md`
- SQL review copy: `.lovable/multi-project-migration.sql`

## Applied migrations
- `drizzle/migrations/0012_multi_project_selection.sql`: profile selection, backfill, validation and cleanup triggers, multi-project invitation acceptance, membership index.
- `drizzle/migrations/0013_atomic_owned_project_creation.sql`: authenticated non-demo creation RPC. Avoids the INSERT RETURNING conflict with membership-only project visibility.
- `drizzle/migrations/0014_uat_guard_table_safe.sql`: fixes pre-existing evaluation of membership-only fields on project rows without weakening last-owner/demo restrictions.

Existing RLS policies were retained. No anonymous project visibility or client audit-write access was added.

## Decisions
- Existing section URLs are unchanged; the active project is shared across sessions for the account, not independent per tab.
- Project transitions cancel reads, discard all cached project data, hide old content and remount page content.
- Any real signed-in user can create a project and becomes its owner; role permissions remain scoped to each project.
- Shared UAT users cannot create or use the ordinary project switcher.
- Database function/trigger behavior is covered by read-only live definition/grant tests; the diagnostic connection cannot impersonate users or write rows.

## Verification
- All 150 tests passed across 22 files, including live permission checks.
- Owner browser: created a second project, added tasks, switched to SalesLeads (tasks absent), switched back (tasks present), refreshed (selection retained).
- Switching completed without page runtime errors; 635 × 495 viewport had no horizontal overflow and the modal is scrollable.
- Current preview compilation passed.

### Role checklist
- **Owner:** create project; switch in both directions; inspect independent configuration and records; create/export work; manage only projects where owner.
- **Member:** switch accessible projects; create/update work only in current project; settings remains denied unless owner in that project.
- **Stakeholder:** switch accessible projects; dashboard/milestones/risks/issues remain readable; tasks, settings and project writes remain denied.
- **Non-member:** unavailable projects absent from switcher; unauthorized selection rejected by server/helper and database validation.
- **UAT:** role switch remains on the same test project; kill switch remains checked by membership helpers.

Member/stakeholder browser flows were not repeated; their permissions were verified by automated role and live policy checks.

## Verification cleanup limitation
Temporary verification tasks were removed and SalesLeads restored as active. The empty **Multi-project verification** project remains because a pre-existing project-deletion audit trigger attempts to write history after the parent project is deleted, violating its foreign key. No audit history was removed and project deletion was not redesigned in this task.