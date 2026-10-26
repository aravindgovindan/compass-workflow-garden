-- Step 7: Risk register + issue log

create type public.risk_status as enum ('open', 'mitigating', 'closed', 'occurred');
create type public.risk_rating as enum ('low', 'medium', 'high', 'critical');
create type public.issue_severity as enum ('low', 'medium', 'high', 'critical');
create type public.issue_status as enum ('open', 'in_progress', 'resolved', 'closed');

-- Single source of truth for rating bands (mirrored by riskScore() in src/lib/risks/score.ts)
create or replace function public.risk_rating_for(_score int) returns public.risk_rating
language sql immutable set search_path = public as $$
  select case when _score >= 15 then 'critical' when _score >= 10 then 'high'
              when _score >= 5 then 'medium' else 'low' end::public.risk_rating
$$;

create table public.risks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text check (description is null or char_length(description) <= 10000),
  category text check (category is null or char_length(category) <= 60),
  probability smallint not null default 3 check (probability between 1 and 5),
  impact smallint not null default 3 check (impact between 1 and 5),
  score smallint generated always as (probability * impact) stored,
  rating public.risk_rating generated always as (public.risk_rating_for(probability * impact)) stored,
  owner_id uuid,
  mitigation_plan text check (mitigation_plan is null or char_length(mitigation_plan) <= 10000),
  status public.risk_status not null default 'open',
  review_date date,
  custom_fields jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index risks_project_idx on public.risks (project_id);
create index risks_project_status_idx on public.risks (project_id, status);
create index risks_owner_idx on public.risks (owner_id);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text check (description is null or char_length(description) <= 10000),
  category text check (category is null or char_length(category) <= 60),
  severity public.issue_severity not null default 'medium',
  raised_by uuid default auth.uid(),
  owner_id uuid,
  status public.issue_status not null default 'open',
  target_date date,
  resolution text check (resolution is null or char_length(resolution) <= 10000),
  source_risk_id uuid references public.risks(id) on delete set null,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index issues_project_idx on public.issues (project_id);
create index issues_project_status_idx on public.issues (project_id, status);
create index issues_owner_idx on public.issues (owner_id);
create index issues_source_risk_idx on public.issues (source_risk_id);

grant select, insert, update, delete on public.risks, public.issues to authenticated;
grant all on public.risks, public.issues to service_role;

alter table public.risks enable row level security;
alter table public.issues enable row level security;

do $$ declare t text; begin
  foreach t in array array['risks','issues'] loop
    execute format('create policy "%s: members read" on public.%I for select to authenticated using (public.is_project_member(project_id, auth.uid()))', t, t);
    execute format('create policy "%s: writers insert" on public.%I for insert to authenticated with check (public.has_project_role(project_id, auth.uid(), array[''owner'',''member'']::public.project_role[]))', t, t);
    execute format('create policy "%s: writers update" on public.%I for update to authenticated using (public.has_project_role(project_id, auth.uid(), array[''owner'',''member'']::public.project_role[])) with check (public.has_project_role(project_id, auth.uid(), array[''owner'',''member'']::public.project_role[]))', t, t);
    execute format('create policy "%s: writers delete" on public.%I for delete to authenticated using (public.has_project_role(project_id, auth.uid(), array[''owner'',''member'']::public.project_role[]))', t, t);
    execute format('create trigger %s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
    execute format('create trigger %s_activity after insert or update or delete on public.%I for each row execute function public.log_activity()', t, t);
  end loop;
end $$;

-- People must be project members; a source risk must be in the same project
create or replace function public.risks_issues_integrity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is not null and not public.is_project_member(new.project_id, new.owner_id) then
    raise exception 'Owner must be on the project'; end if;
  if tg_table_name = 'issues' then
    if new.raised_by is not null and not public.is_project_member(new.project_id, new.raised_by) then
      raise exception 'Raised-by person must be on the project'; end if;
    if new.source_risk_id is not null and not exists (
      select 1 from public.risks where id = new.source_risk_id and project_id = new.project_id) then
      raise exception 'Source risk does not belong to this project'; end if;
  end if;
  return new;
end; $$;
create trigger risks_integrity before insert or update on public.risks for each row execute function public.risks_issues_integrity();
create trigger issues_integrity before insert or update on public.issues for each row execute function public.risks_issues_integrity();

-- Convert a risk to an issue atomically. Runs as the caller, so RLS applies (stakeholders fail).
create or replace function public.convert_risk_to_issue(_risk_id uuid, _severity public.issue_severity)
returns uuid language plpgsql security invoker set search_path = public as $$
declare r public.risks; _id uuid;
begin
  select * into r from public.risks where id = _risk_id for update;
  if not found then raise exception 'Risk not found'; end if;
  if r.status = 'occurred' and exists (select 1 from public.issues where source_risk_id = r.id) then
    raise exception 'This risk has already been converted'; end if;
  insert into public.issues (project_id, title, description, category, severity, owner_id, source_risk_id)
  values (r.project_id, r.title, r.description, r.category, _severity, r.owner_id, r.id)
  returning id into _id;
  update public.risks set status = 'occurred' where id = r.id;
  return _id;
end; $$;
revoke execute on function public.convert_risk_to_issue(uuid, public.issue_severity) from public, anon;
grant execute on function public.convert_risk_to_issue(uuid, public.issue_severity) to authenticated;
