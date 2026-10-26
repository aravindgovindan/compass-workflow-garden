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
