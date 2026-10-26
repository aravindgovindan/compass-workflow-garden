<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture rules

- Every app table has `project_id` (except `profiles`, `projects`), so multi-project support can be added later.
- Roles live only in `project_members`; RLS uses security-definer helpers (`is_project_member`, `has_project_role`) to avoid recursion and privilege escalation.
- Role → section access rules live in `src/lib/auth/roles.ts` (unit-tested); routes use `guardSection()` in `beforeLoad`, and the server/RLS re-checks every read and write.
- Activity log rows are written by the `log_activity()` DB trigger on every audited table, so no write path can skip logging; attach it to each new table.
- Server functions live in `src/functions/*.functions.ts` (not `src/server/`, which is blocked from client bundles); validate input with Zod.
- UI labels for entities come from the terminology map (`src/lib/terminology`), never hard-coded strings.
- Colors only via semantic tokens in `src/styles.css` (incl. health-green/amber/red).
- Project configuration (statuses, priorities, labels, terminology, custom field defs) is loaded once via `projectConfigQuery` (`src/lib/config/use-config.ts`) and invalidated after each settings change; UI labels use `useTerm()`, server code uses `resolveTerm()`.
- Custom field values are validated by `validateCustomValues()` (`src/lib/custom-fields/validate.ts`) on the server before any write; field key and type are immutable after creation, and fields are archived, never deleted.
- Config colors are stored as palette names (`src/lib/config/colors.ts`) and rendered via `--swatch-*` tokens, so themes stay consistent.
- New projects get default config from the `projects_seed_config` trigger (`seed_project_config()`), not from app code.
- Work-item writes use `requireWriter()` / reads `requireTaskReader()` from `src/lib/project-access.server.ts`; task rules (sub-task depth, completed_at, custom-field merge) live in `src/lib/tasks/rules.ts` and are mirrored by the `tasks_integrity()` DB trigger, which is the source of truth.
- /tasks view state (filters, sort, grouping) lives in URL search params parsed by `parseTaskSearch()` (`src/lib/tasks/view-params.ts`), so views are shareable links; saved views store that same object.
- Per-user view settings (List/Board, list columns) live in `user_view_prefs`; saved views in `saved_views`; both are owner-only via RLS and `user_id` filters.
- The task list loads all matching top-level tasks in 1,000-row pages and virtualizes rendering; board columns render 50 cards at a time. Board drops compute positions with `dropPosition()` (`src/lib/tasks/board.ts`).
- Milestone percent complete and status are computed (never stored) by `milestoneProgress()` / `milestoneStatus()` in `src/lib/milestones/status.ts`; only owners may set `status_override` (checked server-side and by the `milestones_integrity()` trigger).
- Risk score/rating bands live in `riskScore()` / `ratingFor()` (`src/lib/risks/score.ts`), mirrored by the generated `score`/`rating` columns via `risk_rating_for()`; risk→issue conversion runs atomically in the `convert_risk_to_issue()` DB function.
- /risks and /issues keep filters, sort, heatmap cell and open item in URL search params (`riskSearch` / `issueSearch` in `src/lib/schemas/registers.ts`); custom values for any entity go through `checkCustomValues()` (`src/lib/custom-fields/defs.server.ts`).

- Membership authorization and people selectors require `active = true`; atomic owner-checked membership/invitation RPCs lock the project and direct authenticated membership writes are revoked, so deactivation and last-owner protection cannot be bypassed.
- Invitation acceptance uses `auth.users` verified email via `accept_pending_invitation()` before session membership is read; profile email never authorizes access, and an active project membership is never silently replaced.
- Collaboration UI shares `RecordTabs`, `CommentsThread` and `ActivityFeed`; server functions in `src/functions/` validate inputs and record access, while comment triggers preserve identity and atomically synchronize mentions.
- Mentions use escaped `@[display name](UUID)` tokens and are derived by database triggers, so the comment body and mention rows cannot diverge.
- Activity APIs are read-only and stakeholder record history is restricted to accessible risks/issues; client audit write privileges and nonread policies are revoked to keep history append-only.
