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
