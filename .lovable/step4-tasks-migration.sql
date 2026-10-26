-- Step 4: Tasks core
create table public.phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 2000),
  start_date date,
  end_date date,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 10000),
  parent_task_id uuid references public.tasks(id) on delete cascade,
  phase_id uuid references public.phases(id) on delete set null,
  status_id uuid not null references public.workflow_statuses(id) on delete restrict,
  priority_id uuid references public.priorities(id) on delete set null,
  assignee_id uuid,
  reporter_id uuid default auth.uid(),
  start_date date,
  due_date date,
  estimate_hours numeric(7,2) check (estimate_hours is null or estimate_hours >= 0),
  position double precision not null default 0,
  custom_fields jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date is null or start_date is null or due_date >= start_date),
  check (parent_task_id is null or parent_task_id <> id)
);
create index tasks_project_idx on public.tasks(project_id);
create index tasks_status_idx on public.tasks(status_id);
create index tasks_assignee_idx on public.tasks(assignee_id);
create index tasks_due_idx on public.tasks(due_date);
create index tasks_parent_idx on public.tasks(parent_task_id);
create index tasks_phase_idx on public.tasks(phase_id);

create table public.task_labels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, label_id)
);
create index task_labels_project_idx on public.task_labels(project_id);

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 300),
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index checklist_task_idx on public.task_checklist_items(task_id);
create index checklist_project_idx on public.task_checklist_items(project_id);

-- Integrity: same project everywhere, one level of sub-tasks, completed_at from status category
create or replace function public.tasks_integrity() returns trigger
language plpgsql security definer set search_path = public as $$
declare _cat public.status_category; _pp uuid;
begin
  select category into _cat from public.workflow_statuses where id = new.status_id and project_id = new.project_id;
  if _cat is null then raise exception 'Status does not belong to this project'; end if;
  if new.priority_id is not null and not exists (select 1 from public.priorities where id = new.priority_id and project_id = new.project_id) then
    raise exception 'Priority does not belong to this project'; end if;
  if new.phase_id is not null and not exists (select 1 from public.phases where id = new.phase_id and project_id = new.project_id) then
    raise exception 'Phase does not belong to this project'; end if;
  if new.parent_task_id is not null then
    select parent_task_id into _pp from public.tasks where id = new.parent_task_id and project_id = new.project_id;
    if not found then raise exception 'Parent task does not belong to this project'; end if;
    if _pp is not null then raise exception 'Sub-tasks cannot have their own sub-tasks'; end if;
    if tg_op = 'UPDATE' and exists (select 1 from public.tasks where parent_task_id = new.id) then
      raise exception 'A task with sub-tasks cannot become a sub-task'; end if;
  end if;
  if _cat = 'done' then
    if tg_op = 'INSERT' or new.completed_at is null or old.status_id is distinct from new.status_id and old.completed_at is null then
      new.completed_at := coalesce(case when tg_op = 'UPDATE' then old.completed_at end, now());
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end; $$;
create trigger tasks_integrity before insert or update on public.tasks
for each row execute function public.tasks_integrity();

create or replace function public.task_child_integrity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.tasks where id = new.task_id and project_id = new.project_id) then
    raise exception 'Task does not belong to this project'; end if;
  if tg_table_name = 'task_labels' and not exists (select 1 from public.labels where id = new.label_id and project_id = new.project_id) then
    raise exception 'Label does not belong to this project'; end if;
  return new;
end; $$;
create trigger task_labels_integrity before insert or update on public.task_labels
for each row execute function public.task_child_integrity();
create trigger checklist_integrity before insert or update on public.task_checklist_items
for each row execute function public.task_child_integrity();

-- Grants, RLS, policies, triggers
do $$
declare t text;
begin
  foreach t in array array['phases','tasks','task_labels','task_checklist_items'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s: members read" on public.%I for select to authenticated using (public.is_project_member(project_id, auth.uid()))', t, t);
    execute format('create policy "%s: writers insert" on public.%I for insert to authenticated with check (public.has_project_role(project_id, auth.uid(), array[''owner'',''member'']::public.project_role[]))', t, t);
    execute format('create policy "%s: writers update" on public.%I for update to authenticated using (public.has_project_role(project_id, auth.uid(), array[''owner'',''member'']::public.project_role[])) with check (public.has_project_role(project_id, auth.uid(), array[''owner'',''member'']::public.project_role[]))', t, t);
    execute format('create policy "%s: writers delete" on public.%I for delete to authenticated using (public.has_project_role(project_id, auth.uid(), array[''owner'',''member'']::public.project_role[]))', t, t);
    execute format('create trigger %s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
    execute format('create trigger %s_activity after insert or update or delete on public.%I for each row execute function public.log_activity()', t, t);
  end loop;
end $$;
