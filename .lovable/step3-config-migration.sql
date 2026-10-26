-- Step 3: Configuration engine
create type public.status_category as enum ('todo','in_progress','done');
create type public.custom_field_entity as enum ('task','risk','issue');
create type public.custom_field_type as enum ('text','long_text','number','date','dropdown','multi_select','user','checkbox','url');

create table public.workflow_statuses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null default 'slate',
  position int not null default 0,
  category public.status_category not null default 'todo',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);
create unique index workflow_statuses_one_default on public.workflow_statuses(project_id) where is_default;

create table public.terminology (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  key text not null check (key in ('task','subtask','phase','milestone','risk','issue','member')),
  singular text not null check (char_length(singular) between 1 and 40),
  plural text not null check (char_length(plural) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, key)
);

create table public.priorities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null default 'slate',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null default 'slate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);

create table public.custom_field_defs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  entity_type public.custom_field_entity not null,
  name text not null check (char_length(name) between 1 and 60),
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  type public.custom_field_type not null,
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  default_value jsonb,
  position int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, entity_type, key)
);

-- Grants, RLS, policies, triggers (same pattern for all five tables)
do $$
declare t text;
begin
  foreach t in array array['workflow_statuses','terminology','priorities','labels','custom_field_defs'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s: members read" on public.%I for select to authenticated using (public.is_project_member(project_id, auth.uid()))', t, t);
    execute format('create policy "%s: owner insert" on public.%I for insert to authenticated with check (public.has_project_role(project_id, auth.uid(), array[''owner''::public.project_role]))', t, t);
    execute format('create policy "%s: owner update" on public.%I for update to authenticated using (public.has_project_role(project_id, auth.uid(), array[''owner''::public.project_role])) with check (public.has_project_role(project_id, auth.uid(), array[''owner''::public.project_role]))', t, t);
    execute format('create policy "%s: owner delete" on public.%I for delete to authenticated using (public.has_project_role(project_id, auth.uid(), array[''owner''::public.project_role]))', t, t);
    execute format('create trigger %s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
    execute format('create trigger %s_activity after insert or update or delete on public.%I for each row execute function public.log_activity()', t, t);
  end loop;
end $$;

-- Default configuration for a project
create or replace function public.seed_project_config(_project_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.workflow_statuses(project_id, name, color, position, category, is_default) values
    (_project_id,'Backlog','slate',0,'todo',false),
    (_project_id,'To Do','blue',1,'todo',true),
    (_project_id,'In Progress','amber',2,'in_progress',false),
    (_project_id,'In Review','violet',3,'in_progress',false),
    (_project_id,'Done','green',4,'done',false)
  on conflict do nothing;
  insert into public.priorities(project_id, name, color, position) values
    (_project_id,'Low','slate',0),(_project_id,'Medium','blue',1),
    (_project_id,'High','amber',2),(_project_id,'Urgent','red',3)
  on conflict do nothing;
  insert into public.terminology(project_id, key, singular, plural) values
    (_project_id,'task','Task','Tasks'),(_project_id,'subtask','Sub-task','Sub-tasks'),
    (_project_id,'phase','Phase','Phases'),(_project_id,'milestone','Milestone','Milestones'),
    (_project_id,'risk','Risk','Risks'),(_project_id,'issue','Issue','Issues'),
    (_project_id,'member','Member','Members')
  on conflict do nothing;
end; $$;
revoke execute on function public.seed_project_config(uuid) from public, anon, authenticated;

create or replace function public.seed_project_config_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform public.seed_project_config(new.id); return new; end; $$;

create trigger projects_seed_config after insert on public.projects
for each row execute function public.seed_project_config_trigger();

-- Backfill existing projects
select public.seed_project_config(id) from public.projects;
