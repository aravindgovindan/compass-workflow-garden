-- DEVELOPMENT ONLY. Seeds 2,000 tasks into the first project for performance testing.
-- Run: psql -v ON_ERROR_STOP=1 -f scripts/seed-tasks.sql
-- Remove later with: delete from public.tasks where title like '[seed] %';
do $$
declare
  p uuid; statuses uuid[]; prios uuid[]; phases uuid[]; members uuid[];
begin
  select id into p from public.projects order by created_at limit 1;
  if p is null then raise exception 'No project yet — finish the setup wizard first.'; end if;
  select array_agg(id order by position) into statuses from public.workflow_statuses where project_id = p;
  select array_agg(id order by position) into prios from public.priorities where project_id = p;
  select array_agg(id) into phases from public.phases where project_id = p;
  select array_agg(user_id) into members from public.project_members where project_id = p and role <> 'stakeholder';
  insert into public.tasks (project_id, title, description, status_id, priority_id, phase_id, assignee_id, due_date, position, custom_fields)
  select p,
    '[seed] Task ' || g,
    case when g % 3 = 0 then 'Seeded description for performance testing #' || g end,
    statuses[1 + (g % array_length(statuses, 1))],
    prios[1 + (g % coalesce(array_length(prios, 1), 1))],
    case when phases is null then null else phases[1 + (g % array_length(phases, 1))] end,
    case when members is null or g % 4 = 0 then null else members[1 + (g % array_length(members, 1))] end,
    current_date + ((g % 120) - 30),
    g,
    '{}'::jsonb
  from generate_series(1, 2000) g;
  raise notice 'Seeded 2000 tasks into project %', p;
end $$;
