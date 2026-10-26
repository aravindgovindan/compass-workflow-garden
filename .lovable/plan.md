# Step 10 — Hardening and Demo Data

## Permission fixes
- Deny direct task, checklist, task-label and phase reads to stakeholders; keep dashboard and milestone summaries through narrowly scoped, membership-checked aggregate functions.
- Remove former creators’ access after membership ends.
- Require active owner/member roles for saved-view deletion and preference updates.
- Revoke unnecessary client writes on mentions/invitations, block custom-field deletion, and audit preference changes.
- Document every server endpoint, every live RLS policy and every app-section guard in a project audit report; add executable permission regressions.

## Demo data
- Add Settings → Demo data with owner-only Load demo and Remove demo actions.
- Load exactly 40 work items (32 top-level plus 8 sub-items), 3 phases, 4 milestones, 8 risks, 5 issues, checklists, and comments with valid active-person mentions.
- Use current configuration and validated custom fields; dates are relative to the load date in UTC.
- One transaction and project lock prevent partial/duplicate loads. Track inserted IDs, not titles.
- Removal deletes only tracked demo records. Preserve real records, settings, members and audit history; detach real child items and links. Refuse removal when new real comments exist on demo records, instead of deleting them silently.
- A demo-only project becomes blank after removal; existing real records are never wiped.

## Page resilience
- Reuse shared retryable error and not-found screens at the root and router defaults.
- Add pending/error/not-found boundaries for blocking loaders; add retry to record-list errors.
- Preserve input and show friendly failures for mutations, including network errors.

## Policy explanations
- Work-item SELECT policies: only active owners and members can read individual work items.
- Project SELECT: only active project members can read the project.
- Saved-view UPDATE/DELETE and preference UPDATE: only the record owner with an active owner/member project role may mutate it.
- Demo SELECT/INSERT/UPDATE/DELETE: only active project owners can manage their project’s tracked demo batch.
- Aggregate functions: verify active membership before returning summaries; stakeholder payloads omit private task rows and project activity.
- Activity history: no client writes; database triggers append changes.

## Validation and delivery
- Run existing tests plus permission, demo counts/configuration/date and failure-handling tests.
- Exercise owner load → reload → inspect pages → remove → reload through the signed-in UI.
- Include changed-file/migration list, fixes, decisions and owner/member/stakeholder checklist in the audit report.

## Technical details: proposed SQL
```sql
-- Restrict direct work-item reads; stakeholders use aggregate RPCs only.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['tasks','task_labels','task_checklist_items','phases'] LOOP
  EXECUTE format('DROP POLICY "%s: members read" ON public.%I',t,t);
  EXECUTE format('CREATE POLICY "%s: writers read" ON public.%I FOR SELECT TO authenticated USING (public.has_project_role(project_id,auth.uid(),ARRAY[''owner'',''member'']::public.project_role[]))',t,t);
 END LOOP;
END $$;
ALTER POLICY "projects: members read" ON public.projects USING (public.is_project_member(id,auth.uid()));
ALTER POLICY "saved_views: own delete" ON public.saved_views USING (user_id=auth.uid() AND public.has_project_role(project_id,auth.uid(),ARRAY['owner','member']::public.project_role[]));
ALTER POLICY "saved_views: own update" ON public.saved_views USING (user_id=auth.uid() AND public.has_project_role(project_id,auth.uid(),ARRAY['owner','member']::public.project_role[])) WITH CHECK (user_id=auth.uid() AND public.has_project_role(project_id,auth.uid(),ARRAY['owner','member']::public.project_role[]));
ALTER POLICY "view_prefs: own update" ON public.user_view_prefs USING (user_id=auth.uid() AND public.has_project_role(project_id,auth.uid(),ARRAY['owner','member']::public.project_role[])) WITH CHECK (user_id=auth.uid() AND public.has_project_role(project_id,auth.uid(),ARRAY['owner','member']::public.project_role[]));
REVOKE INSERT,UPDATE,DELETE ON public.activity_log,public.mentions,public.pending_invitations FROM authenticated,anon;
REVOKE DELETE ON public.custom_field_defs FROM authenticated,anon;
CREATE TRIGGER user_view_prefs_activity AFTER INSERT OR UPDATE OR DELETE ON public.user_view_prefs FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Narrow, caller-checked aggregate endpoints retain stakeholder summaries without raw task access.
CREATE OR REPLACE FUNCTION public.milestone_summaries(_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_project_member(_project_id,auth.uid()) THEN RAISE EXCEPTION 'Project access denied'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.target_date, x.id), '[]'::jsonb)
  FROM (
    SELECT m.*, count(t.id)::integer AS total,
      count(t.id) FILTER (WHERE s.category = 'done')::integer AS done
    FROM public.milestones m
    LEFT JOIN public.tasks t ON t.milestone_id = m.id AND t.project_id = m.project_id
    LEFT JOIN public.workflow_statuses s ON s.id = t.status_id AND s.project_id = m.project_id
    WHERE m.project_id = _project_id
      AND public.is_project_member(_project_id, auth.uid())
    GROUP BY m.id
  ) x);
END;
$$;
REVOKE ALL ON FUNCTION public.milestone_summaries(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.milestone_summaries(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dashboard_snapshot(_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
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


CREATE TABLE public.demo_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
 manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.demo_batches TO authenticated;
GRANT ALL ON public.demo_batches TO service_role;
ALTER TABLE public.demo_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo: owner read" ON public.demo_batches FOR SELECT TO authenticated USING(public.has_project_role(project_id,auth.uid(),ARRAY['owner']::public.project_role[]));
CREATE POLICY "demo: owner insert" ON public.demo_batches FOR INSERT TO authenticated WITH CHECK(public.has_project_role(project_id,auth.uid(),ARRAY['owner']::public.project_role[]));
CREATE POLICY "demo: owner update" ON public.demo_batches FOR UPDATE TO authenticated USING(public.has_project_role(project_id,auth.uid(),ARRAY['owner']::public.project_role[])) WITH CHECK(public.has_project_role(project_id,auth.uid(),ARRAY['owner']::public.project_role[]));
CREATE POLICY "demo: owner delete" ON public.demo_batches FOR DELETE TO authenticated USING(public.has_project_role(project_id,auth.uid(),ARRAY['owner']::public.project_role[]));
CREATE TRIGGER demo_batches_updated_at BEFORE UPDATE ON public.demo_batches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER demo_batches_activity AFTER INSERT OR UPDATE OR DELETE ON public.demo_batches FOR EACH ROW EXECUTE FUNCTION public.log_activity();

CREATE OR REPLACE FUNCTION public.load_demo_data(_project_id uuid,_payload jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE item jsonb; eid uuid; ph uuid[]:='{}'; ms uuid[]:='{}'; ts uuid[]:='{}'; rs uuid[]:='{}'; iss uuid[]:='{}'; cs uuid[]:='{}'; k integer:=0;
BEGIN
 PERFORM 1 FROM public.projects WHERE id=_project_id FOR UPDATE;
 IF NOT public.has_project_role(_project_id,auth.uid(),ARRAY['owner']::public.project_role[]) THEN RAISE EXCEPTION 'Owner access required'; END IF;
 IF EXISTS(SELECT 1 FROM public.demo_batches WHERE project_id=_project_id) THEN RETURN false; END IF;
 IF jsonb_array_length(_payload->'tasks')<>40 OR jsonb_array_length(_payload->'phases')<>3 OR jsonb_array_length(_payload->'milestones')<>4 OR jsonb_array_length(_payload->'risks')<>8 OR jsonb_array_length(_payload->'issues')<>5 THEN RAISE EXCEPTION 'Invalid demo dataset'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(_payload->'phases') LOOP
  INSERT INTO public.phases(project_id,name,start_date,end_date,position) VALUES(_project_id,item->>'name',(item->>'start_date')::date,(item->>'end_date')::date,cardinality(ph)) RETURNING id INTO eid; ph:=array_append(ph,eid);
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(_payload->'milestones') LOOP
  INSERT INTO public.milestones(project_id,name,description,target_date,owner_id) VALUES(_project_id,item->>'name',item->>'description',(item->>'target_date')::date,auth.uid()) RETURNING id INTO eid; ms:=array_append(ms,eid);
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(_payload->'tasks') LOOP
  INSERT INTO public.tasks(project_id,title,description,phase_id,milestone_id,parent_task_id,status_id,priority_id,assignee_id,reporter_id,start_date,due_date,estimate_hours,position,custom_fields)
  VALUES(_project_id,item->>'title',item->>'description',ph[(item->>'phase')::int+1],ms[(item->>'milestone')::int+1],ts[(item->>'parent')::int+1],(item->>'status_id')::uuid,(item->>'priority_id')::uuid,auth.uid(),auth.uid(),(item->>'start_date')::date,(item->>'due_date')::date,4,k,COALESCE(item->'custom_fields','{}'::jsonb)) RETURNING id INTO eid;
  ts:=array_append(ts,eid); k:=k+1;
  IF k<=10 THEN
   INSERT INTO public.task_checklist_items(project_id,task_id,text,done,position) VALUES(_project_id,eid,'Review acceptance criteria',k%3=0,0),(_project_id,eid,'Confirm evidence with the team',false,1);
  END IF;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(_payload->'risks') LOOP
  INSERT INTO public.risks(project_id,title,description,category,probability,impact,owner_id,created_by,mitigation_plan,status,review_date,custom_fields)
  VALUES(_project_id,item->>'title',item->>'description','Delivery',(item->>'probability')::int,(item->>'impact')::int,auth.uid(),auth.uid(),item->>'mitigation_plan',(item->>'status')::public.risk_status,(item->>'review_date')::date,COALESCE(item->'custom_fields','{}'::jsonb)) RETURNING id INTO eid; rs:=array_append(rs,eid);
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(_payload->'issues') LOOP
  INSERT INTO public.issues(project_id,title,description,severity,owner_id,raised_by,status,target_date,custom_fields)
  VALUES(_project_id,item->>'title',item->>'description',(item->>'severity')::public.issue_severity,auth.uid(),auth.uid(),(item->>'status')::public.issue_status,(item->>'target_date')::date,COALESCE(item->'custom_fields','{}'::jsonb)) RETURNING id INTO eid; iss:=array_append(iss,eid);
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(_payload->'comments') LOOP
  INSERT INTO public.comments(project_id,entity_type,entity_id,author_id,body)
  VALUES(_project_id,item->>'entity_type',CASE item->>'entity_type' WHEN 'task' THEN ts[(item->>'index')::int+1] WHEN 'risk' THEN rs[(item->>'index')::int+1] ELSE iss[(item->>'index')::int+1] END,auth.uid(),item->>'body') RETURNING id INTO eid; cs:=array_append(cs,eid);
 END LOOP;
 INSERT INTO public.demo_batches(project_id,manifest) VALUES(_project_id,jsonb_build_object('phases',ph,'milestones',ms,'tasks',ts,'risks',rs,'issues',iss,'comments',cs));
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.remove_demo_data(_project_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE m jsonb; ts uuid[]; rs uuid[]; iss uuid[]; cs uuid[];
BEGIN
 PERFORM 1 FROM public.projects WHERE id=_project_id FOR UPDATE;
 IF NOT public.has_project_role(_project_id,auth.uid(),ARRAY['owner']::public.project_role[]) THEN RAISE EXCEPTION 'Owner access required'; END IF;
 SELECT manifest INTO m FROM public.demo_batches WHERE project_id=_project_id;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT array_agg(value::uuid) INTO ts FROM jsonb_array_elements_text(m->'tasks');
 SELECT array_agg(value::uuid) INTO rs FROM jsonb_array_elements_text(m->'risks');
 SELECT array_agg(value::uuid) INTO iss FROM jsonb_array_elements_text(m->'issues');
 SELECT array_agg(value::uuid) INTO cs FROM jsonb_array_elements_text(m->'comments');
 IF EXISTS(SELECT 1 FROM public.comments WHERE project_id=_project_id AND NOT(id=ANY(cs)) AND (entity_id=ANY(ts) OR entity_id=ANY(rs) OR entity_id=ANY(iss))) THEN RAISE EXCEPTION 'Remove your new comments on demo records before removing the demo'; END IF;
 -- Preserve real children and links; remove only tracked records.
 UPDATE public.tasks SET parent_task_id=NULL WHERE project_id=_project_id AND parent_task_id=ANY(ts) AND NOT(id=ANY(ts));
 DELETE FROM public.comments WHERE project_id=_project_id AND id=ANY(cs);
 DELETE FROM public.tasks WHERE project_id=_project_id AND id=ANY(ts);
 DELETE FROM public.issues WHERE project_id=_project_id AND id=ANY(iss);
 DELETE FROM public.risks WHERE project_id=_project_id AND id=ANY(rs);
 DELETE FROM public.milestones WHERE project_id=_project_id AND id IN(SELECT value::uuid FROM jsonb_array_elements_text(m->'milestones'));
 DELETE FROM public.phases WHERE project_id=_project_id AND id IN(SELECT value::uuid FROM jsonb_array_elements_text(m->'phases'));
 DELETE FROM public.demo_batches WHERE project_id=_project_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.load_demo_data(uuid,jsonb),public.remove_demo_data(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.load_demo_data(uuid,jsonb),public.remove_demo_data(uuid) TO authenticated,service_role;

```
