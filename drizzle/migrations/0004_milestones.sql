-- Step 6: Milestones + task link

create type public.milestone_status as enum ('upcoming', 'at_risk', 'achieved', 'missed');

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (description is null or char_length(description) <= 5000),
  target_date date not null,
  owner_id uuid,
  status_override public.milestone_status,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index milestones_project_date_idx on public.milestones (project_id, target_date);

-- One milestone per task; deleting a milestone unlinks its tasks
alter table public.tasks add column milestone_id uuid references public.milestones(id) on delete set null;
create index tasks_milestone_idx on public.tasks (milestone_id);

grant select, insert, update, delete on public.milestones to authenticated;
grant all on public.milestones to service_role;

alter table public.milestones enable row level security;

create policy "milestones: members read" on public.milestones for select to authenticated
  using (public.is_project_member(project_id, auth.uid()));
create policy "milestones: writers insert" on public.milestones for insert to authenticated
  with check (public.has_project_role(project_id, auth.uid(), array['owner','member']::public.project_role[]));
create policy "milestones: writers update" on public.milestones for update to authenticated
  using (public.has_project_role(project_id, auth.uid(), array['owner','member']::public.project_role[]))
  with check (public.has_project_role(project_id, auth.uid(), array['owner','member']::public.project_role[]));
create policy "milestones: writers delete" on public.milestones for delete to authenticated
  using (public.has_project_role(project_id, auth.uid(), array['owner','member']::public.project_role[]));

-- Only owners may set or clear status_override; owner_id must be a project member
create or replace function public.milestones_integrity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is not null and not public.is_project_member(new.project_id, new.owner_id) then
    raise exception 'Milestone owner must be on the project'; end if;
  if auth.uid() is not null
     and new.status_override is distinct from (case when tg_op = 'UPDATE' then old.status_override else null end)
     and not public.has_project_role(new.project_id, auth.uid(), array['owner']::public.project_role[]) then
    raise exception 'Only the project owner can override milestone status'; end if;
  return new;
end; $$;
create trigger milestones_integrity before insert or update on public.milestones
for each row execute function public.milestones_integrity();

-- A task can only link to a milestone in its own project
create or replace function public.tasks_milestone_integrity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.milestone_id is not null and not exists (
    select 1 from public.milestones where id = new.milestone_id and project_id = new.project_id) then
    raise exception 'Milestone does not belong to this project'; end if;
  return new;
end; $$;
create trigger tasks_milestone_integrity before insert or update of milestone_id on public.tasks
for each row execute function public.tasks_milestone_integrity();

create trigger milestones_updated_at before update on public.milestones for each row execute function public.set_updated_at();
create trigger milestones_activity after insert or update or delete on public.milestones for each row execute function public.log_activity();
