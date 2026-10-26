# Compass Workflow — Phase 1 permission audit

Audited 2026-10-26 against source and the live Lovable Cloud database.

## Result and fixed gaps

- All 22 public application tables have RLS enabled. All eight app sections use their matching guard in `src/lib/auth/roles.ts`.
- Every one of the 71 server endpoints uses authenticated middleware. Project endpoints then check active membership and the appropriate role server-side. Session lookup and first-run project creation are explicit account/bootstrap exceptions, not project-data bypasses.
- Fixed stakeholder direct reads of tasks, task-label links, checklists and phases. Aggregate dashboard and milestone RPCs now verify active membership and project scope as narrowly projected SECURITY DEFINER functions; private dashboard lists remain owner/member-only.
- Fixed `listMilestoneTasks`: server task-reader role check added, and linked-task controls hidden for stakeholders.
- Removed the `created_by` project-read exception so a former creator cannot retain read access after deactivation.
- Fixed saved-view DELETE/UPDATE and preference UPDATE policies to require an active owner/member role, not just the stored user ID.
- Revoked redundant authenticated writes on mentions and invitations; revoked custom-field DELETE so archiving cannot be bypassed. Existing audit and membership write revocations remain in place.
- Added activity logging for user view preferences and demo batch records.
- Fixed a pre-existing checklist integrity trigger: a compound condition referenced a nonexistent `label_id` field on checklist records. A nested label-only branch now avoids that error. Real demo loading verified 20 checklist inserts after this repair.
- Custom-field and preference read failures no longer silently look like empty configuration/default preferences.
- Live checks confirmed Step 8 collaboration RPCs, active membership helpers and policies are present; the historical proposal comment in the earlier migration is not evidence that it was unapplied.

## Every server function

Read means records the endpoint can access; write is its permitted mutation scope. All project scopes are restricted to the caller’s active project. RLS rechecks ordinary queries; management RPCs also validate caller roles.

| File | Endpoint | Read scope | Write scope | Server check |
|---|---|---|---|---|
| `activity.functions.ts` | `listActivity` | Owner/member; stakeholder accessible risk/issue history only | None | projectAccess + can_read_discussion for record-scoped history |
| `comments.functions.ts` | `listComments` | Owner/member; stakeholder accessible risk/issue only | None | recordAccess + can_read_discussion; collaboration role/authorship checks |
| `comments.functions.ts` | `createComment` | Owner/member; stakeholder accessible risk/issue only | Owner/member as self | recordAccess + can_read_discussion; collaboration role/authorship checks |
| `comments.functions.ts` | `updateComment` | Owner/member; stakeholder accessible risk/issue only | Author owner/member only | recordAccess + can_read_discussion; collaboration role/authorship checks |
| `comments.functions.ts` | `deleteComment` | Owner/member; stakeholder accessible risk/issue only | Owner or member author | recordAccess + can_read_discussion; collaboration role/authorship checks |
| `config.functions.ts` | `getProjectConfig` | Active owner/member/stakeholder | None | currentProjectId / requireOwner + has_project_role |
| `config.functions.ts` | `createStatus` | Active owner | Owner only | currentProjectId / requireOwner + has_project_role |
| `config.functions.ts` | `updateStatus` | Active owner | Owner only | currentProjectId / requireOwner + has_project_role |
| `config.functions.ts` | `deleteStatus` | Active owner | Owner only | currentProjectId / requireOwner + has_project_role |
| `config.functions.ts` | `createPriority` | Active owner | Owner only | currentProjectId / requireOwner + has_project_role |
| `config.functions.ts` | `updatePriority` | Active owner | Owner only | currentProjectId / requireOwner + has_project_role |
| `config.functions.ts` | `deletePriority` | Active owner | Owner only | currentProjectId / requireOwner + has_project_role |
| `config.functions.ts` | `createLabel` | Active owner | Owner only | currentProjectId / requireOwner + has_project_role |
| `config.functions.ts` | `updateLabel` | Active owner | Owner only | currentProjectId / requireOwner + has_project_role |
| `config.functions.ts` | `deleteLabel` | Active owner | Owner only | currentProjectId / requireOwner + has_project_role |
| `config.functions.ts` | `reorderConfig` | Active owner | Owner only | currentProjectId / requireOwner + has_project_role |
| `config.functions.ts` | `saveTerminology` | Active owner | Owner only | currentProjectId / requireOwner + has_project_role |
| `config.functions.ts` | `createCustomField` | Active owner | Owner only | currentProjectId / requireOwner + has_project_role |
| `config.functions.ts` | `updateCustomField` | Active owner | Owner only | currentProjectId / requireOwner + has_project_role |
| `dashboard.functions.ts` | `getDashboard` | Active owner/member/stakeholder | None | projectAccess; dashboard_snapshot checks active role; privateDashboardData strips private lists |
| `demo.functions.ts` | `getDemoState` | Owner | None | projectAccess + assertDemoOwner; RPC rechecks owner |
| `demo.functions.ts` | `loadDemo` | Owner | Owner only | projectAccess + assertDemoOwner; RPC rechecks owner |
| `demo.functions.ts` | `removeDemo` | Owner | Owner only | projectAccess + assertDemoOwner; RPC rechecks owner |
| `exports.functions.ts` | `exportTasks` | Owner/member | None (CSV output only) | projectAccess + assertCanExport |
| `exports.functions.ts` | `exportMilestones` | Owner/member/stakeholder | None (CSV output only) | projectAccess + assertCanExport |
| `exports.functions.ts` | `exportRisks` | Owner/member/stakeholder | None (CSV output only) | projectAccess + assertCanExport |
| `exports.functions.ts` | `exportIssues` | Owner/member/stakeholder | None (CSV output only) | projectAccess + assertCanExport |
| `issues.functions.ts` | `listIssues` | Active owner/member/stakeholder | None | projectAccess (active membership) |
| `issues.functions.ts` | `getIssue` | Active owner/member/stakeholder | None | projectAccess (active membership) |
| `issues.functions.ts` | `createIssue` | Active owner/member/stakeholder | Owner/member | projectAccess + assertCanWriteRegister/assertCanWriteMilestone or requireWriter |
| `issues.functions.ts` | `updateIssue` | Active owner/member/stakeholder | Owner/member | projectAccess + assertCanWriteRegister/assertCanWriteMilestone or requireWriter |
| `issues.functions.ts` | `deleteIssue` | Active owner/member/stakeholder | Owner/member | projectAccess + assertCanWriteRegister/assertCanWriteMilestone or requireWriter |
| `milestones.functions.ts` | `listMilestones` | Active owner/member/stakeholder | None | projectAccess (active membership) |
| `milestones.functions.ts` | `listMilestoneTasks` | Active owner/member | None | requireTaskReader / requireWriter; ownView for private views |
| `milestones.functions.ts` | `createMilestone` | Active owner/member/stakeholder | Owner/member; milestone override owner only | projectAccess + assertCanWriteRegister/assertCanWriteMilestone or requireWriter |
| `milestones.functions.ts` | `updateMilestone` | Active owner/member/stakeholder | Owner/member; milestone override owner only | projectAccess + assertCanWriteRegister/assertCanWriteMilestone or requireWriter |
| `milestones.functions.ts` | `deleteMilestone` | Active owner/member/stakeholder | Owner/member; milestone override owner only | projectAccess + assertCanWriteRegister/assertCanWriteMilestone or requireWriter |
| `milestones.functions.ts` | `linkTasksToMilestone` | Active owner/member/stakeholder | Owner/member; milestone override owner only | projectAccess + assertCanWriteRegister/assertCanWriteMilestone or requireWriter |
| `milestones.functions.ts` | `unlinkTaskFromMilestone` | Active owner/member/stakeholder | Owner/member; milestone override owner only | projectAccess + assertCanWriteRegister/assertCanWriteMilestone or requireWriter |
| `phases.functions.ts` | `listPhases` | Active owner/member | None | requireTaskReader / requireWriter; ownView for private views |
| `phases.functions.ts` | `createPhase` | Active owner/member | Owner/member | requireTaskReader / requireWriter; ownView for private views |
| `phases.functions.ts` | `updatePhase` | Active owner/member | Owner/member | requireTaskReader / requireWriter; ownView for private views |
| `phases.functions.ts` | `reorderPhases` | Active owner/member | Owner/member | requireTaskReader / requireWriter; ownView for private views |
| `phases.functions.ts` | `deletePhase` | Active owner/member | Owner/member | requireTaskReader / requireWriter; ownView for private views |
| `project.functions.ts` | `createProject` | Own membership check | Signed-in non-member creates own first project | Auth middleware; active membership count; created_by=userId; DB owner trigger |
| `risks.functions.ts` | `listRisks` | Active owner/member/stakeholder | None | projectAccess (active membership) |
| `risks.functions.ts` | `getRisk` | Active owner/member/stakeholder | None | projectAccess (active membership) |
| `risks.functions.ts` | `createRisk` | Active owner/member/stakeholder | Owner/member | projectAccess + assertCanWriteRegister/assertCanWriteMilestone or requireWriter |
| `risks.functions.ts` | `updateRisk` | Active owner/member/stakeholder | Owner/member | projectAccess + assertCanWriteRegister/assertCanWriteMilestone or requireWriter |
| `risks.functions.ts` | `deleteRisk` | Active owner/member/stakeholder | Owner/member | projectAccess + assertCanWriteRegister/assertCanWriteMilestone or requireWriter |
| `risks.functions.ts` | `convertRiskToIssue` | Active owner/member/stakeholder | Owner/member | projectAccess + assertCanWriteRegister/assertCanWriteMilestone or requireWriter |
| `session.functions.ts` | `getCurrentUser` | Authenticated self and active membership | Verified pending invitation acceptance only | Authenticated user ID; accept_pending_invitation checks verified auth email |
| `tasks.functions.ts` | `listTasks` | Active owner/member | None | requireTaskReader / requireWriter; ownView for private views |
| `tasks.functions.ts` | `getTask` | Active owner/member | None | requireTaskReader / requireWriter; ownView for private views |
| `tasks.functions.ts` | `createTask` | Active owner/member | Owner/member | requireTaskReader / requireWriter; ownView for private views |
| `tasks.functions.ts` | `updateTask` | Active owner/member | Owner/member | requireTaskReader / requireWriter; ownView for private views |
| `tasks.functions.ts` | `moveTask` | Active owner/member | Owner/member | requireTaskReader / requireWriter; ownView for private views |
| `tasks.functions.ts` | `deleteTask` | Active owner/member | Owner/member | requireTaskReader / requireWriter; ownView for private views |
| `tasks.functions.ts` | `setTaskLabels` | Active owner/member | Owner/member | requireTaskReader / requireWriter; ownView for private views |
| `tasks.functions.ts` | `addChecklistItem` | Active owner/member | Owner/member | requireTaskReader / requireWriter; ownView for private views |
| `tasks.functions.ts` | `updateChecklistItem` | Active owner/member | Owner/member | requireTaskReader / requireWriter; ownView for private views |
| `tasks.functions.ts` | `reorderChecklist` | Active owner/member | Owner/member | requireTaskReader / requireWriter; ownView for private views |
| `tasks.functions.ts` | `deleteChecklistItem` | Active owner/member | Owner/member | requireTaskReader / requireWriter; ownView for private views |
| `team.functions.ts` | `listTeam` | Owner/member | None | requireTaskReader or owner(); owner-checked RPC |
| `team.functions.ts` | `listInvitations` | Owner | None | requireTaskReader or owner(); owner-checked RPC |
| `team.functions.ts` | `inviteMember` | Owner | Owner only | requireTaskReader or owner(); owner-checked RPC |
| `team.functions.ts` | `revokeInvitation` | Owner | Owner only | requireTaskReader or owner(); owner-checked RPC |
| `team.functions.ts` | `changeMember` | Owner | Owner only | requireTaskReader or owner(); owner-checked RPC |
| `views.functions.ts` | `listSavedViews` | Active owner/member | None | requireTaskReader / requireWriter; ownView for private views |
| `views.functions.ts` | `saveView` | Active owner/member | Own record, owner/member | requireTaskReader / requireWriter; ownView for private views |
| `views.functions.ts` | `renameView` | Active owner/member | Own record, owner/member | requireTaskReader / requireWriter; ownView for private views |
| `views.functions.ts` | `deleteView` | Active owner/member | Own record, owner/member | requireTaskReader / requireWriter; ownView for private views |
| `views.functions.ts` | `getViewPrefs` | Active owner/member | None | requireTaskReader / requireWriter; ownView for private views |
| `views.functions.ts` | `setViewPrefs` | Active owner/member | Own record, owner/member | requireTaskReader / requireWriter; ownView for private views |

## Every table and client write grant

`authenticated` is the database API role shared by signed-in app users; these grants alone never override RLS. Owner/member/stakeholder are application roles in project_members. Service-role maintenance bypasses RLS and is never exposed to clients.

| Table | RLS enabled | Client INSERT / UPDATE / DELETE grants |
|---|---|---|
| `activity_log` | true | no / no / no |
| `comments` | true | yes / yes / yes |
| `custom_field_defs` | true | yes / yes / no |
| `demo_batches` | true | yes / yes / yes |
| `issues` | true | yes / yes / yes |
| `labels` | true | yes / yes / yes |
| `mentions` | true | no / no / no |
| `milestones` | true | yes / yes / yes |
| `pending_invitations` | true | no / no / no |
| `phases` | true | yes / yes / yes |
| `priorities` | true | yes / yes / yes |
| `profiles` | true | yes / yes / yes |
| `project_members` | true | no / no / no |
| `projects` | true | yes / yes / yes |
| `risks` | true | yes / yes / yes |
| `saved_views` | true | yes / yes / yes |
| `task_checklist_items` | true | yes / yes / yes |
| `task_labels` | true | yes / yes / yes |
| `tasks` | true | yes / yes / yes |
| `terminology` | true | yes / yes / yes |
| `user_view_prefs` | true | yes / yes / yes |
| `workflow_statuses` | true | yes / yes / yes |

## Every live RLS policy

Tables without an operation policy deny that operation. Profiles intentionally allow self account-profile updates independent of project roles; this cannot change membership or permissions. The first-run projects INSERT policy is likewise a bootstrap exception, not permission to write an existing project.

| Table | Policy | Operation | Allowed app role / scope |
|---|---|---|
| `activity_log` | activity: owners and members read | SELECT | Owner/member |
| `activity_log` | activity: stakeholders risk and issue history | SELECT | Stakeholder: accessible risk/issue record history only |
| `comments` | comments: authors or owners delete | DELETE | Owner; member author only |
| `comments` | comments: writers create as self | INSERT | Owner/member as self on accessible record |
| `comments` | comments: record readers | SELECT | Owner/member; stakeholder risk/issue only |
| `comments` | comments: authors edit | UPDATE | Owner/member author only |
| `custom_field_defs` | custom_field_defs: owner delete | DELETE | Active owner |
| `custom_field_defs` | custom_field_defs: owner insert | INSERT | Active owner |
| `custom_field_defs` | custom_field_defs: members read | SELECT | Active owner/member/stakeholder |
| `custom_field_defs` | custom_field_defs: owner update | UPDATE | Active owner |
| `demo_batches` | demo: owner delete | DELETE | Active owner |
| `demo_batches` | demo: owner insert | INSERT | Active owner |
| `demo_batches` | demo: owner read | SELECT | Active owner |
| `demo_batches` | demo: owner update | UPDATE | Active owner |
| `issues` | issues: writers delete | DELETE | Active owner/member |
| `issues` | issues: writers insert | INSERT | Active owner/member |
| `issues` | issues: members read | SELECT | Active owner/member/stakeholder |
| `issues` | issues: writers update | UPDATE | Active owner/member |
| `labels` | labels: owner delete | DELETE | Active owner |
| `labels` | labels: owner insert | INSERT | Active owner |
| `labels` | labels: members read | SELECT | Active owner/member/stakeholder |
| `labels` | labels: owner update | UPDATE | Active owner |
| `mentions` | mentions: comment readers | SELECT | Accessible comment readers; writes by trigger only |
| `milestones` | milestones: writers delete | DELETE | Active owner/member |
| `milestones` | milestones: writers insert | INSERT | Active owner/member |
| `milestones` | milestones: members read | SELECT | Active owner/member/stakeholder |
| `milestones` | milestones: writers update | UPDATE | Active owner/member |
| `pending_invitations` | invitations: owners read | SELECT | Active owner |
| `phases` | phases: writers delete | DELETE | Active owner/member |
| `phases` | phases: writers insert | INSERT | Active owner/member |
| `phases` | phases: writers read | SELECT | Active owner/member |
| `phases` | phases: writers update | UPDATE | Active owner/member |
| `priorities` | priorities: owner delete | DELETE | Active owner |
| `priorities` | priorities: owner insert | INSERT | Active owner |
| `priorities` | priorities: members read | SELECT | Active owner/member/stakeholder |
| `priorities` | priorities: owner update | UPDATE | Active owner |
| `profiles` | profiles: insert self | INSERT | Self (account profile; no project role changes) |
| `profiles` | profiles: read self or teammates | SELECT | Self; SELECT also active teammates |
| `profiles` | profiles: update self | UPDATE | Self (account profile; no project role changes) |
| `project_members` | members: owner delete | DELETE | Owner policy, but client grants revoked; owner-checked RPC only |
| `project_members` | members: owner insert | INSERT | Owner policy, but client grants revoked; owner-checked RPC only |
| `project_members` | members: members read | SELECT | Active owner/member/stakeholder |
| `project_members` | members: owner update | UPDATE | Owner policy, but client grants revoked; owner-checked RPC only |
| `projects` | projects: owner delete | DELETE | Active owner |
| `projects` | projects: signed-in create | INSERT | Authenticated creator (first-run exception; endpoint rejects existing membership) |
| `projects` | projects: members read | SELECT | Active owner/member/stakeholder |
| `projects` | projects: owner update | UPDATE | Active owner |
| `risks` | risks: writers delete | DELETE | Active owner/member |
| `risks` | risks: writers insert | INSERT | Active owner/member |
| `risks` | risks: members read | SELECT | Active owner/member/stakeholder |
| `risks` | risks: writers update | UPDATE | Active owner/member |
| `saved_views` | saved_views: own delete | DELETE | Own record; active owner/member for writes, active membership for reads |
| `saved_views` | saved_views: own insert | INSERT | Own record; active owner/member for writes, active membership for reads |
| `saved_views` | saved_views: own read | SELECT | Own record; active owner/member for writes, active membership for reads |
| `saved_views` | saved_views: own update | UPDATE | Own record; active owner/member for writes, active membership for reads |
| `task_checklist_items` | task_checklist_items: writers delete | DELETE | Active owner/member |
| `task_checklist_items` | task_checklist_items: writers insert | INSERT | Active owner/member |
| `task_checklist_items` | task_checklist_items: writers read | SELECT | Active owner/member |
| `task_checklist_items` | task_checklist_items: writers update | UPDATE | Active owner/member |
| `task_labels` | task_labels: writers delete | DELETE | Active owner/member |
| `task_labels` | task_labels: writers insert | INSERT | Active owner/member |
| `task_labels` | task_labels: writers read | SELECT | Active owner/member |
| `task_labels` | task_labels: writers update | UPDATE | Active owner/member |
| `tasks` | tasks: writers delete | DELETE | Active owner/member |
| `tasks` | tasks: writers insert | INSERT | Active owner/member |
| `tasks` | tasks: writers read | SELECT | Active owner/member |
| `tasks` | tasks: writers update | UPDATE | Active owner/member |
| `terminology` | terminology: owner delete | DELETE | Active owner |
| `terminology` | terminology: owner insert | INSERT | Active owner |
| `terminology` | terminology: members read | SELECT | Active owner/member/stakeholder |
| `terminology` | terminology: owner update | UPDATE | Active owner |
| `user_view_prefs` | view_prefs: own insert | INSERT | Own record; active owner/member for writes, active membership for reads |
| `user_view_prefs` | view_prefs: own read | SELECT | Own record; active owner/member for writes, active membership for reads |
| `user_view_prefs` | view_prefs: own update | UPDATE | Own record; active owner/member for writes, active membership for reads |
| `workflow_statuses` | workflow_statuses: owner delete | DELETE | Active owner |
| `workflow_statuses` | workflow_statuses: owner insert | INSERT | Active owner |
| `workflow_statuses` | workflow_statuses: members read | SELECT | Active owner/member/stakeholder |
| `workflow_statuses` | workflow_statuses: owner update | UPDATE | Active owner |

## Exact policy expressions

<details><summary>Live policy predicates</summary>

### activity_log — activity: owners and members read
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
WITH CHECK: not applicable
```

### activity_log — activity: stakeholders risk and issue history
```sql
USING: (has_project_role(project_id, auth.uid(), ARRAY['stakeholder'::project_role]) AND (((entity_type = 'risks'::text) AND can_read_discussion(project_id, 'risk'::text, entity_id)) OR ((entity_type = 'issues'::text) AND can_read_discussion(project_id, 'issue'::text, entity_id))))
WITH CHECK: not applicable
```

### comments — comments: authors or owners delete
```sql
USING: (can_read_discussion(project_id, entity_type, entity_id) AND (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role]) OR ((author_id = auth.uid()) AND has_project_role(project_id, auth.uid(), ARRAY['member'::project_role]))))
WITH CHECK: not applicable
```

### comments — comments: writers create as self
```sql
USING: not applicable
WITH CHECK: ((author_id = auth.uid()) AND has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role]) AND can_read_discussion(project_id, entity_type, entity_id))
```

### comments — comments: record readers
```sql
USING: can_read_discussion(project_id, entity_type, entity_id)
WITH CHECK: not applicable
```

### comments — comments: authors edit
```sql
USING: ((author_id = auth.uid()) AND has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role]) AND can_read_discussion(project_id, entity_type, entity_id))
WITH CHECK: ((author_id = auth.uid()) AND has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role]) AND can_read_discussion(project_id, entity_type, entity_id))
```

### custom_field_defs — custom_field_defs: owner delete
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
WITH CHECK: not applicable
```

### custom_field_defs — custom_field_defs: owner insert
```sql
USING: not applicable
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
```

### custom_field_defs — custom_field_defs: members read
```sql
USING: is_project_member(project_id, auth.uid())
WITH CHECK: not applicable
```

### custom_field_defs — custom_field_defs: owner update
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
```

### demo_batches — demo: owner delete
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
WITH CHECK: not applicable
```

### demo_batches — demo: owner insert
```sql
USING: not applicable
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
```

### demo_batches — demo: owner read
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
WITH CHECK: not applicable
```

### demo_batches — demo: owner update
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
```

### issues — issues: writers delete
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
WITH CHECK: not applicable
```

### issues — issues: writers insert
```sql
USING: not applicable
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
```

### issues — issues: members read
```sql
USING: is_project_member(project_id, auth.uid())
WITH CHECK: not applicable
```

### issues — issues: writers update
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
```

### labels — labels: owner delete
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
WITH CHECK: not applicable
```

### labels — labels: owner insert
```sql
USING: not applicable
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
```

### labels — labels: members read
```sql
USING: is_project_member(project_id, auth.uid())
WITH CHECK: not applicable
```

### labels — labels: owner update
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
```

### mentions — mentions: comment readers
```sql
USING: (EXISTS ( SELECT 1
   FROM comments c
  WHERE ((c.id = mentions.comment_id) AND (c.project_id = mentions.project_id))))
WITH CHECK: not applicable
```

### milestones — milestones: writers delete
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
WITH CHECK: not applicable
```

### milestones — milestones: writers insert
```sql
USING: not applicable
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
```

### milestones — milestones: members read
```sql
USING: is_project_member(project_id, auth.uid())
WITH CHECK: not applicable
```

### milestones — milestones: writers update
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
```

### pending_invitations — invitations: owners read
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
WITH CHECK: not applicable
```

### phases — phases: writers delete
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
WITH CHECK: not applicable
```

### phases — phases: writers insert
```sql
USING: not applicable
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
```

### phases — phases: writers read
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
WITH CHECK: not applicable
```

### phases — phases: writers update
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
```

### priorities — priorities: owner delete
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
WITH CHECK: not applicable
```

### priorities — priorities: owner insert
```sql
USING: not applicable
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
```

### priorities — priorities: members read
```sql
USING: is_project_member(project_id, auth.uid())
WITH CHECK: not applicable
```

### priorities — priorities: owner update
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
```

### profiles — profiles: insert self
```sql
USING: not applicable
WITH CHECK: (id = auth.uid())
```

### profiles — profiles: read self or teammates
```sql
USING: ((id = auth.uid()) OR shares_project_with(id, auth.uid()))
WITH CHECK: not applicable
```

### profiles — profiles: update self
```sql
USING: (id = auth.uid())
WITH CHECK: (id = auth.uid())
```

### project_members — members: owner delete
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
WITH CHECK: not applicable
```

### project_members — members: owner insert
```sql
USING: not applicable
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
```

### project_members — members: members read
```sql
USING: is_project_member(project_id, auth.uid())
WITH CHECK: not applicable
```

### project_members — members: owner update
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
WITH CHECK: not applicable
```

### projects — projects: owner delete
```sql
USING: has_project_role(id, auth.uid(), ARRAY['owner'::project_role])
WITH CHECK: not applicable
```

### projects — projects: signed-in create
```sql
USING: not applicable
WITH CHECK: (created_by = auth.uid())
```

### projects — projects: members read
```sql
USING: is_project_member(id, auth.uid())
WITH CHECK: not applicable
```

### projects — projects: owner update
```sql
USING: has_project_role(id, auth.uid(), ARRAY['owner'::project_role])
WITH CHECK: not applicable
```

### risks — risks: writers delete
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
WITH CHECK: not applicable
```

### risks — risks: writers insert
```sql
USING: not applicable
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
```

### risks — risks: members read
```sql
USING: is_project_member(project_id, auth.uid())
WITH CHECK: not applicable
```

### risks — risks: writers update
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
```

### saved_views — saved_views: own delete
```sql
USING: ((user_id = auth.uid()) AND has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role]))
WITH CHECK: not applicable
```

### saved_views — saved_views: own insert
```sql
USING: not applicable
WITH CHECK: ((user_id = auth.uid()) AND ((project_role_of(project_id, auth.uid()))::text = ANY (ARRAY['owner'::text, 'member'::text])))
```

### saved_views — saved_views: own read
```sql
USING: ((user_id = auth.uid()) AND is_project_member(project_id, auth.uid()))
WITH CHECK: not applicable
```

### saved_views — saved_views: own update
```sql
USING: ((user_id = auth.uid()) AND has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role]))
WITH CHECK: ((user_id = auth.uid()) AND has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role]))
```

### task_checklist_items — task_checklist_items: writers delete
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
WITH CHECK: not applicable
```

### task_checklist_items — task_checklist_items: writers insert
```sql
USING: not applicable
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
```

### task_checklist_items — task_checklist_items: writers read
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
WITH CHECK: not applicable
```

### task_checklist_items — task_checklist_items: writers update
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
```

### task_labels — task_labels: writers delete
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
WITH CHECK: not applicable
```

### task_labels — task_labels: writers insert
```sql
USING: not applicable
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
```

### task_labels — task_labels: writers read
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
WITH CHECK: not applicable
```

### task_labels — task_labels: writers update
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
```

### tasks — tasks: writers delete
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
WITH CHECK: not applicable
```

### tasks — tasks: writers insert
```sql
USING: not applicable
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
```

### tasks — tasks: writers read
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
WITH CHECK: not applicable
```

### tasks — tasks: writers update
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role])
```

### terminology — terminology: owner delete
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
WITH CHECK: not applicable
```

### terminology — terminology: owner insert
```sql
USING: not applicable
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
```

### terminology — terminology: members read
```sql
USING: is_project_member(project_id, auth.uid())
WITH CHECK: not applicable
```

### terminology — terminology: owner update
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
```

### user_view_prefs — view_prefs: own insert
```sql
USING: not applicable
WITH CHECK: ((user_id = auth.uid()) AND ((project_role_of(project_id, auth.uid()))::text = ANY (ARRAY['owner'::text, 'member'::text])))
```

### user_view_prefs — view_prefs: own read
```sql
USING: ((user_id = auth.uid()) AND is_project_member(project_id, auth.uid()))
WITH CHECK: not applicable
```

### user_view_prefs — view_prefs: own update
```sql
USING: ((user_id = auth.uid()) AND has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role]))
WITH CHECK: ((user_id = auth.uid()) AND has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'member'::project_role]))
```

### workflow_statuses — workflow_statuses: owner delete
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
WITH CHECK: not applicable
```

### workflow_statuses — workflow_statuses: owner insert
```sql
USING: not applicable
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
```

### workflow_statuses — workflow_statuses: members read
```sql
USING: is_project_member(project_id, auth.uid())
WITH CHECK: not applicable
```

### workflow_statuses — workflow_statuses: owner update
```sql
USING: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
WITH CHECK: has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role])
```

</details>

## Route coverage

| Surface | Access | State coverage |
|---|---|---|
| `/`, `/login`, `/reset-password` | Public account screens; no project data | Form busy/error states; root fallback |
| `/setup` | Signed-in first-run; app shell redirects non-members here | Wizard validation/busy/error states |
| `/dashboard` | `guardSection("dashboard")` — Owner/member/stakeholder | Loading, empty, error and retry; shared route fallback |
| `/tasks` | `guardSection("tasks")` — Owner/member | Loading, empty, error and retry; shared route fallback |
| `/milestones` | `guardSection("milestones")` — Owner/member/stakeholder | Loading, empty, error and retry; shared route fallback |
| `/risks` | `guardSection("risks")` — Owner/member/stakeholder | Loading, empty, error and retry; shared route fallback |
| `/issues` | `guardSection("issues")` — Owner/member/stakeholder | Loading, empty, error and retry; shared route fallback |
| `/team` | `guardSection("team")` — Owner/member | Loading, empty, error and retry; shared route fallback |
| `/activity` | `guardSection("activity")` — Owner/member | Loading, empty, error and retry; shared route fallback |
| `/settings` | `guardSection("settings")` — Owner | Loading, empty, error and retry; shared route fallback |

No missing section guards were found. Public and layout routes are not section routes; the managed authenticated layout remains unchanged. All content routes were inspected for title, description, og:title, og:description, og:type and twitter:card.

## Demo lifecycle decisions

- Settings → Demo data; owner only. Exact volume: 40 tasks (32 parent tasks + 8 sub-tasks), 3 phases, 4 milestones, 8 risks, 5 issues, 20 checklist entries and 6 comments with mentions.
- Server Zod validation, configured category-based status IDs and priority IDs, terminology lookup, validated custom values and UTC relative dates. No fabricated team accounts.
- Database transaction + project lock + unique per-project manifest make loading atomic and idempotent. Reload safely is a no-op, not a reset.
- Removal uses tracked IDs, preserves non-demo records/config/members/audit, detaches real sub-tasks and retains real links as unlinked items. New real comments on demo records block removal rather than disappear. Edits to tracked demo records are explicitly removed after confirmation.
- A blank project means no work records, not erased audit history. The tested project was returned to its original empty-work state after verification.

## States and verification

- Shared root/router error and 404 screens use accessible design-system controls. Team and Activity blocking loaders now have local pending/error/not-found boundaries. App layout has a local error boundary.
- Existing Tasks/Risks/Issues/Milestones retry controls were already present and retained. Shared mutation hooks now translate network failures; a global mutation-cache fallback handles mutations without their own error handler. Quick Add already had shared rollback/error handling; no duplicate toast was added.
- Signed-in owner browser flow: load → reload safely → all seven non-settings app pages render without alerts → remove → hard refresh confirms removal → dashboard returns to 0 of 0.
- Forced server request failure showed a friendly connection message; Try again restored the page after requests resumed. Unmatched URL displayed the 404 screen.
- Automated coverage includes role helpers, live RLS/grant/aggregate-definition regression checks and demo configuration/count/date tests. Live policy tests are not authenticated mutation execution tests: sandbox SQL access cannot assume authenticated roles or create auth fixtures. Member/stakeholder browser sessions remain unverified; their helpers and actual live policies are covered.
- No production publication performed.

## Changed files and migrations

- `drizzle/migrations/0008_phase1_hardening_demo.sql` — RLS/grant repairs, secure aggregates, demo manifest and RPCs.
- `drizzle/migrations/0009_fix_checklist_integrity.sql` — checklist trigger repair.
- Generated `src/integrations/supabase/types.ts` refreshed by the migration tool.
- New: `src/functions/demo.functions.ts`, `src/lib/demo/data.ts`, `src/components/settings/demo-tab.tsx`, `src/lib/errors.ts`, `src/components/common/route-states.tsx`.
- New tests: `src/lib/demo/data.test.ts`, `src/lib/errors.test.ts`, `src/lib/auth/server-access.test.ts`, `src/test/permissions.integration.test.ts`.
- Updated routes: `__root.tsx`, app `route.tsx`, `settings.tsx`, `milestones.tsx`, `team.tsx`, `activity.tsx`; updated `src/router.tsx`.
- Updated server reads: `src/functions/milestones.functions.ts`, `views.functions.ts`, `src/lib/custom-fields/defs.server.ts`.
- Updated shared UI/query hooks: `src/components/common/empty-state.tsx`, `src/lib/config/use-config.ts`, `src/lib/tasks/queries.ts`, `view-queries.ts`, `src/lib/registers/queries.ts`, `src/lib/milestones/queries.ts`, `src/lib/collaboration/queries.ts`.
- Updated documentation: `README.md`, `AGENTS.md`, `roadmap.md`, this audit and the approved SQL proposal; saved demo safety constraints in project memory.

## Three-role checklist

- **Owner:** Load and repeat-load demo; verify 40 total/32 top-level tasks, sub-tasks/checklists, 4 milestone summaries, 8 risks, 5 issues and comments/mentions. Remove and refresh; real work/config/members remain and audit remains append-only. Retry after a failed request.
- **Member:** Create/update work and own comments; cannot open Settings, change configuration, manage demo/invitations or override milestone status. Own saved views and preferences still work.
- **Stakeholder:** Dashboard summaries and milestones/risks/issues remain readable; no task titles, linked-task controls, private activity or write actions. Tasks/config/demo mutations are denied.
- **Non-member / inactive member:** No project rows; aggregate RPCs reject project access; app shell routes to setup.
- **All clients:** Audit INSERT/UPDATE/DELETE grants are absent; mentions cannot be directly modified.
