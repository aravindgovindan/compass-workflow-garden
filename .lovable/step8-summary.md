# Step 8 — Team and Collaboration

## Delivered
Team directory, owner-controlled invitations and membership, open-task reassignment on deactivation, last-owner protection, task/risk/issue comments with mentions, record History tabs, and filtered paginated activity.

## Migration
`drizzle/migrations/0006_team_collaboration.sql` (proposal: `.lovable/step8-collaboration-migration.sql`). Adds active membership safeguards, pending invitations, comments, mentions, verified-email acceptance and append-only audit protections. SQL was shown first but applied without a separate approval response.

## Changed files
- Functions: `team.functions.ts`, `comments.functions.ts`, `activity.functions.ts`; active membership checks in session, project, config, tasks and milestones functions.
- Shared helpers: `src/lib/collaboration/{rules.ts,schemas.ts,queries.ts,rules.test.ts}`, `src/lib/project-access.server.ts`, `src/lib/custom-fields/defs.server.ts`.
- UI: `src/components/collaboration/{team-directory,mention-editor,comments-thread,activity-feed,activity-page,record-tabs}.tsx`; task, risk and issue drawers; app shell.
- Routes: team and activity pages; metadata on setup and app content routes.
- Documentation: `AGENTS.md`, `roadmap.md`, SQL proposal and collaboration requirements memory.

## Decisions and limitations
- Owners share the existing sign-in link manually; no invitation email or mention notifications.
- Verified auth email authorizes acceptance; profile email does not.
- Existing active membership is not replaced; invitations to another project remain pending, preserving single-project scope.
- Activity logging is trigger-backed and append-only.
- Stakeholders can read risk/issue discussions and history, never task discussions.

## Verification
95 tests passed; latest preview build OK. Signed-in owner checks passed for risk mentions, comment editing/deletion, record history, activity filters, invitation creation/revocation and last-owner protection. Task comment saving/history passed using dispatched control events; ordinary pointer interaction in the task drawer remains unverified because browser automation stalled. Narrow-screen Team page has no document overflow. Temporary task/risk/issue records were removed; the revoked verification invitation remains in audit history.

## Role checklist
- Owner: invite/revoke; change a member role; deactivate with reassignment/unassignment; verify the last owner cannot be removed; create/edit own comments and delete another author's comment; filter activity.
- Member: view Team without management controls; create/edit/delete own comments; verify editing/deleting others' comments is denied; read record history and activity.
- Stakeholder: Team, Activity and Tasks redirect to Dashboard; risk/issue comments and History are readable with no posting/edit/delete controls; direct writes are denied.

Member/stakeholder browser sessions and verified-email acceptance were not exercised end-to-end; unit tests cover their access rules. Step 9 dashboard/export is not built.