# Step 9 — Dashboard and CSV Export

## Dashboard
- Replace the dashboard placeholder with project details, completion, status and assignee charts, overdue count, the next five incomplete milestones, open risk/issue counts and recent activity.
- Owners and members see overdue task titles and activity; stakeholders receive only aggregates and permitted milestone data.
- Count all tasks, including sub-tasks; done uses status category, never status name. Overdue means an unfinished task due before today (UTC).
- Include empty states, skeletons and refresh on return or tab focus.

## CSV exports
- Add Export to Tasks, Milestones, Risks and Issues; export all matching rows, not just the visible page.
- Reuse existing filters and sort rules; Milestones currently has no filters, so exports its date-sorted list.
- Resolve configured entity terminology, status/priority/person names and active custom-field display names. Milestones currently has no custom-field definitions.
- Escape quotes, commas and newlines and prefix dangerous spreadsheet cells with an apostrophe, including dangerous characters after leading whitespace.
- Tasks: owners/members only. Other exports: all active project roles. Show progress/errors and deliver a real CSV download.

## Database access rules
No new tables or RLS policies are introduced:
- Existing project SELECT policies continue to scope every aggregate to active project membership.
- Both read-only functions run as the caller, preserving RLS; anonymous callers cannot execute them.
- Dashboard verifies the active project role and omits task detail/activity queries for stakeholders.
- New indexes support due-date, linked milestone and recent activity reads.

## Technical details
- One authenticated `dashboard.functions.ts` function calls the SQL aggregate and computes milestone statuses with the existing tested helper.
- Shared server-side list helpers prevent nested server-function calls and pagination truncation in exports.
- Route loading uses Query cache priming and subscription, with role-sensitive query keys.
- Add unit tests and verify actual signed-in data and CSV downloads; document any role-session verification limits.

## SQL to apply after approval
```sql
-- Read-only aggregate functions. SECURITY INVOKER retains the caller's RLS.
CREATE OR REPLACE FUNCTION public.milestone_summaries(_project_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.target_date, x.id), '[]'::jsonb)
  FROM (
    SELECT m.*, count(t.id)::integer AS total,
      count(t.id) FILTER (WHERE s.category = 'done')::integer AS done
    FROM public.milestones m
    LEFT JOIN public.tasks t ON t.milestone_id = m.id AND t.project_id = m.project_id
    LEFT JOIN public.workflow_statuses s ON s.id = t.status_id AND s.project_id = m.project_id
    WHERE m.project_id = _project_id
      AND public.is_project_member(_project_id, auth.uid())
    GROUP BY m.id
  ) x;
$$;
REVOKE ALL ON FUNCTION public.milestone_summaries(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.milestone_summaries(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dashboard_snapshot(_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  caller_role public.project_role;
  result jsonb;
BEGIN
  caller_role := public.project_role_of(_project_id, auth.uid());
  IF caller_role IS NULL THEN RAISE EXCEPTION 'Project access denied'; END IF;
  WITH status_counts AS (
    SELECT s.id, s.name, s.color, s.category, s.position, count(t.id)::integer AS count
    FROM public.workflow_statuses s
    LEFT JOIN public.tasks t ON t.status_id = s.id AND t.project_id = s.project_id
    WHERE s.project_id = _project_id GROUP BY s.id
  ), assignee_counts AS (
    SELECT t.assignee_id, COALESCE(p.full_name, 'Unassigned') AS name, count(*)::integer AS count
    FROM public.tasks t LEFT JOIN public.profiles p ON p.id = t.assignee_id
    WHERE t.project_id = _project_id GROUP BY t.assignee_id, p.full_name
  ), risk_counts AS (
    SELECT rating, count(*)::integer AS count FROM public.risks
    WHERE project_id = _project_id AND status IN ('open', 'mitigating') GROUP BY rating
  ), issue_counts AS (
    SELECT severity, count(*)::integer AS count FROM public.issues
    WHERE project_id = _project_id AND status IN ('open', 'in_progress') GROUP BY severity
  )
  SELECT jsonb_build_object(
    'project', (SELECT jsonb_build_object('id', id, 'name', name, 'code', code,
      'status', status, 'health', health, 'start_date', start_date,
      'target_end_date', target_end_date, 'objectives', objectives)
      FROM public.projects WHERE id = _project_id),
    'today', (now() AT TIME ZONE 'UTC')::date,
    'statuses', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY position, id) FROM status_counts s), '[]'::jsonb),
    'total', COALESCE((SELECT sum(count) FROM status_counts), 0),
    'done', COALESCE((SELECT sum(count) FROM status_counts WHERE category = 'done'), 0),
    'assignees', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY count DESC, name) FROM assignee_counts a), '[]'::jsonb),
    'overdue_count', (SELECT count(*) FROM public.tasks t
      JOIN public.workflow_statuses s ON s.id = t.status_id AND s.project_id = t.project_id
      WHERE t.project_id = _project_id AND s.category <> 'done'
        AND t.due_date < (now() AT TIME ZONE 'UTC')::date),
    'milestones', public.milestone_summaries(_project_id),
    'risks', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM risk_counts r), '[]'::jsonb),
    'issues', COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM issue_counts i), '[]'::jsonb)
  ) INTO result;
  -- Private lists are not queried or returned for stakeholders.
  IF caller_role IN ('owner', 'member') THEN
    result := result || jsonb_build_object(
      'overdue', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.due_date, x.id) FROM (
        SELECT t.id, t.title, t.due_date FROM public.tasks t
        JOIN public.workflow_statuses s ON s.id = t.status_id AND s.project_id = t.project_id
        WHERE t.project_id = _project_id AND s.category <> 'done'
          AND t.due_date < (now() AT TIME ZONE 'UTC')::date
        ORDER BY t.due_date, t.id LIMIT 10
      ) x), '[]'::jsonb),
      'activity', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC, x.id DESC) FROM (
        SELECT a.id, a.entity_type, a.entity_id, a.action, a.created_at,
          COALESCE(p.full_name, 'System') AS actor_name
        FROM public.activity_log a LEFT JOIN public.profiles p ON p.id = a.actor_id
        WHERE a.project_id = _project_id ORDER BY a.created_at DESC, a.id DESC LIMIT 10
      ) x), '[]'::jsonb)
    );
  END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.dashboard_snapshot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_snapshot(uuid) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS tasks_project_due_dashboard_idx ON public.tasks(project_id, due_date, id) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_project_milestone_status_idx ON public.tasks(project_id, milestone_id, status_id) WHERE milestone_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS activity_project_recent_idx ON public.activity_log(project_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS milestones_project_target_idx ON public.milestones(project_id, target_date, id);```
