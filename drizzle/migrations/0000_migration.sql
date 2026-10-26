-- Enums
create type public.project_role as enum ('owner','member','stakeholder');
create type public.project_health as enum ('green','amber','red');

-- updated_at helper
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  avatar_url text,
  job_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
          new.email,
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Projects (profile fields filled in by the setup step)
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  description text,
  objectives text,
  sponsor text,
  start_date date,
  target_end_date date,
  status text not null default 'active',
  health public.project_health not null default 'green',
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;
create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();

-- Membership & roles
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null,
  role public.project_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);
grant select, insert, update, delete on public.project_members to authenticated;
grant all on public.project_members to service_role;
alter table public.project_members enable row level security;

create or replace function public.project_role_of(_project_id uuid, _user_id uuid)
returns public.project_role language sql stable security definer set search_path = public as $$
  select role from public.project_members where project_id = _project_id and user_id = _user_id
$$;
create or replace function public.is_project_member(_project_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.project_members where project_id = _project_id and user_id = _user_id)
$$;
create or replace function public.has_project_role(_project_id uuid, _user_id uuid, _roles public.project_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.project_members where project_id = _project_id and user_id = _user_id and role = any(_roles))
$$;
create or replace function public.shares_project_with(_other uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.project_members a join public.project_members b on a.project_id = b.project_id
                where a.user_id = _user_id and b.user_id = _other)
$$;

-- Owner auto-membership when a project is created
create or replace function public.add_project_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_members(project_id, user_id, role) values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end; $$;
create trigger projects_add_owner after insert on public.projects for each row execute function public.add_project_owner();

-- Policies: profiles
create policy "profiles: read self or teammates" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_project_with(id, auth.uid()));
create policy "profiles: insert self" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles: update self" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Policies: projects
create policy "projects: members read" on public.projects for select to authenticated
  using (public.is_project_member(id, auth.uid()) or created_by = auth.uid());
create policy "projects: signed-in create" on public.projects for insert to authenticated with check (created_by = auth.uid());
create policy "projects: owner update" on public.projects for update to authenticated
  using (public.has_project_role(id, auth.uid(), array['owner']::public.project_role[]));
create policy "projects: owner delete" on public.projects for delete to authenticated
  using (public.has_project_role(id, auth.uid(), array['owner']::public.project_role[]));

-- Policies: members
create policy "members: members read" on public.project_members for select to authenticated
  using (public.is_project_member(project_id, auth.uid()));
create policy "members: owner insert" on public.project_members for insert to authenticated
  with check (public.has_project_role(project_id, auth.uid(), array['owner']::public.project_role[]));
create policy "members: owner update" on public.project_members for update to authenticated
  using (public.has_project_role(project_id, auth.uid(), array['owner']::public.project_role[]));
create policy "members: owner delete" on public.project_members for delete to authenticated
  using (public.has_project_role(project_id, auth.uid(), array['owner']::public.project_role[]));

-- Activity log (written by triggers only)
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid,
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('create','update','delete')),
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_project_idx on public.activity_log(project_id, created_at desc);
grant select on public.activity_log to authenticated;
grant all on public.activity_log to service_role;
alter table public.activity_log enable row level security;
create policy "activity: owners and members read" on public.activity_log for select to authenticated
  using (public.has_project_role(project_id, auth.uid(), array['owner','member']::public.project_role[]));

create or replace function public.log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  _pid uuid; _eid uuid; _act text; _changes jsonb := '{}'::jsonb; k text;
  _old jsonb; _new jsonb;
begin
  if tg_op = 'DELETE' then _old := to_jsonb(old); _new := null; _act := 'delete';
  elsif tg_op = 'INSERT' then _old := null; _new := to_jsonb(new); _act := 'create';
  else _old := to_jsonb(old); _new := to_jsonb(new); _act := 'update'; end if;
  if tg_table_name = 'projects' then _pid := coalesce(_new->>'id', _old->>'id')::uuid;
  else _pid := coalesce(_new->>'project_id', _old->>'project_id')::uuid; end if;
  _eid := coalesce(_new->>'id', _old->>'id')::uuid;
  if _act = 'update' then
    for k in select jsonb_object_keys(_new) loop
      if k not in ('updated_at') and (_new->k) is distinct from (_old->k) then
        _changes := _changes || jsonb_build_object(k, jsonb_build_object('from', _old->k, 'to', _new->k));
      end if;
    end loop;
    if _changes = '{}'::jsonb then return new; end if;
  elsif _act = 'create' then _changes := jsonb_build_object('after', _new);
  else _changes := jsonb_build_object('before', _old); end if;
  if tg_op = 'DELETE' and tg_table_name = 'projects' then return old; end if;
  insert into public.activity_log(project_id, actor_id, entity_type, entity_id, action, changes)
  values (_pid, auth.uid(), tg_table_name, _eid, _act, _changes);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

create trigger projects_activity after insert or update or delete on public.projects for each row execute function public.log_activity();
create trigger project_members_activity after insert or update or delete on public.project_members for each row execute function public.log_activity();