-- Step 8 proposal. Not applied until approval.
-- Membership deactivation retains historical rows but removes all authorization.
alter table public.project_members add column active boolean not null default true;
alter table public.project_members add column updated_at timestamptz not null default now();
create trigger project_members_updated_at before update on public.project_members
for each row execute function public.set_updated_at();

create or replace function public.is_project_member(_project_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.project_members where project_id = _project_id and user_id = _user_id and active)
$$;
create or replace function public.has_project_role(_project_id uuid, _user_id uuid, _roles public.project_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.project_members where project_id = _project_id and user_id = _user_id and active and role = any(_roles))
$$;
create or replace function public.project_role_of(_project_id uuid, _user_id uuid)
returns public.project_role language sql stable security definer set search_path = public as $$
  select role from public.project_members where project_id = _project_id and user_id = _user_id and active
$$;
create or replace function public.shares_project_with(_other uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.project_members a join public.project_members b on a.project_id = b.project_id
    where a.user_id = _user_id and b.user_id = _other and a.active and b.active)
$$;

-- Serialize owner mutations. Immutable membership identity prevents moving a row to another project.
create or replace function public.membership_integrity() returns trigger
language plpgsql security definer set search_path = public as $$
declare _pid uuid;
begin
  _pid := case when tg_op = 'DELETE' then old.project_id else new.project_id end;
  perform 1 from public.projects where id = _pid for update;
  if tg_op = 'UPDATE' and (new.project_id <> old.project_id or new.user_id <> old.user_id) then
    raise exception 'Membership identity cannot change';
  end if;
  if tg_op <> 'INSERT' and old.active and old.role = 'owner' then
    if tg_op = 'DELETE' then
      if exists(select 1 from public.projects where id = _pid) and not exists(
        select 1 from public.project_members where project_id = _pid and active and role = 'owner' and id <> old.id
      ) then raise exception 'The last owner cannot be removed or demoted'; end if;
    elsif not new.active or new.role <> 'owner' then
      if not exists(select 1 from public.project_members where project_id = _pid and active and role = 'owner' and id <> old.id)
      then raise exception 'The last owner cannot be removed or demoted'; end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger membership_integrity before insert or update or delete on public.project_members
for each row execute function public.membership_integrity();

-- Client DML cannot bypass atomic role/deactivation operations; reads still use existing RLS.
revoke insert, update, delete on public.project_members from authenticated, anon;

create table public.pending_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  role public.project_role not null default 'member',
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_by uuid not null default auth.uid(),
  accepted_by uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.pending_invitations to authenticated;
grant all on public.pending_invitations to service_role;
alter table public.pending_invitations enable row level security;
create policy "invitations: owners read" on public.pending_invitations for select to authenticated
using (public.has_project_role(project_id, auth.uid(), array['owner']::public.project_role[]));
create unique index invitations_pending_email_idx on public.pending_invitations(project_id,email) where status = 'pending';
create index invitations_email_idx on public.pending_invitations(email,status);
create trigger invitations_updated_at before update on public.pending_invitations for each row execute function public.set_updated_at();
create trigger invitations_activity after insert or update or delete on public.pending_invitations for each row execute function public.log_activity();

-- Owner RPCs re-check authority after locking the project. No service client needed.
create or replace function public.invite_project_member(_project_id uuid, _email text, _role public.project_role)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid; _normalized text := lower(btrim(_email));
begin
  perform 1 from public.projects where id = _project_id for update;
  if not public.has_project_role(_project_id, auth.uid(), array['owner']::public.project_role[]) then raise exception 'Owner access required'; end if;
  if _normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'A valid email is required'; end if;
  if exists(select 1 from public.project_members m join auth.users u on u.id = m.user_id
    where m.project_id = _project_id and m.active and lower(u.email) = _normalized)
  then raise exception 'This person is already on the project'; end if;
  insert into public.pending_invitations(project_id,email,role,invited_by)
  values(_project_id,_normalized,_role,auth.uid()) returning id into _id;
  return _id;
end $$;
create or replace function public.revoke_project_invitation(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _pid uuid;
begin
  select project_id into _pid from public.pending_invitations where id = _id;
  perform 1 from public.projects where id = _pid for update;
  if not public.has_project_role(_pid, auth.uid(), array['owner']::public.project_role[]) then raise exception 'Owner access required'; end if;
  update public.pending_invitations set status = 'revoked' where id = _id and status = 'pending';
  if not found then raise exception 'Pending invitation not found'; end if;
end $$;

-- Called on first authenticated arrival, BEFORE setup routing; uses verified auth email, not editable profile data.
-- Existing accounts use the same acceptance path on their next sign-in. No invitation email is sent.
create or replace function public.accept_pending_invitation()
returns uuid language plpgsql security definer set search_path = public as $$
declare _email text; inv public.pending_invitations;
begin
  select lower(email) into _email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if _email is null then return null; end if;
  if exists(select 1 from public.project_members where user_id = auth.uid() and active) then return null; end if;
  select * into inv from public.pending_invitations where email = _email and status = 'pending' order by created_at,id limit 1;
  if not found then return null; end if;
  perform 1 from public.projects where id = inv.project_id for update;
  select * into inv from public.pending_invitations where id = inv.id and status = 'pending' for update;
  if not found then return null; end if;
  -- Serialize concurrent acceptance by the same user across different projects.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 8));
  if exists(select 1 from public.project_members where user_id = auth.uid() and active) then return null; end if;
  insert into public.project_members(project_id,user_id,role,active)
  values(inv.project_id,auth.uid(),inv.role,true)
  on conflict(project_id,user_id) do update set role = excluded.role, active = true;
  update public.pending_invitations set status = 'accepted',accepted_by = auth.uid(),accepted_at = now() where id = inv.id;
  return inv.project_id;
end $$;

create or replace function public.change_project_member(_project_id uuid, _user_id uuid, _role public.project_role,
  _deactivate boolean default false, _reassign_to uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.projects where id = _project_id for update;
  if not public.has_project_role(_project_id, auth.uid(), array['owner']::public.project_role[]) then raise exception 'Owner access required'; end if;
  if not public.is_project_member(_project_id, _user_id) then raise exception 'Active member not found'; end if;
  if _deactivate then
    if _reassign_to = _user_id or (_reassign_to is not null and not public.is_project_member(_project_id,_reassign_to))
    then raise exception 'Choose another active project member'; end if;
    update public.tasks t set assignee_id = _reassign_to
      where t.project_id = _project_id and t.assignee_id = _user_id
      and exists(select 1 from public.workflow_statuses s where s.id = t.status_id and s.category <> 'done');
  end if;
  update public.project_members set role = _role, active = not _deactivate
    where project_id = _project_id and user_id = _user_id;
end $$;

do $$ declare sig text; begin
  foreach sig in array array[
    'public.invite_project_member(uuid,text,public.project_role)',
    'public.revoke_project_invitation(uuid)', 'public.accept_pending_invitation()',
    'public.change_project_member(uuid,uuid,public.project_role,boolean,uuid)'
  ] loop
    execute 'revoke execute on function ' || sig || ' from public, anon';
    execute 'grant execute on function ' || sig || ' to authenticated';
  end loop;
end $$;

-- Record readability is deliberately stricter for tasks than existing aggregate task RLS.
create or replace function public.can_read_discussion(_pid uuid, _type text, _eid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_project_member(_pid,auth.uid()) and case _type
    when 'task' then public.has_project_role(_pid,auth.uid(),array['owner','member']::public.project_role[])
      and exists(select 1 from public.tasks where id = _eid and project_id = _pid)
    when 'risk' then exists(select 1 from public.risks where id = _eid and project_id = _pid)
    when 'issue' then exists(select 1 from public.issues where id = _eid and project_id = _pid)
    else false end
$$;
revoke execute on function public.can_read_discussion(uuid,text,uuid) from public, anon;
grant execute on function public.can_read_discussion(uuid,text,uuid) to authenticated;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  entity_type text not null check (entity_type in ('task','risk','issue')),
  entity_id uuid not null,
  author_id uuid not null default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.comments to authenticated;
grant all on public.comments to service_role;
alter table public.comments enable row level security;
create policy "comments: record readers" on public.comments for select to authenticated
using(public.can_read_discussion(project_id,entity_type,entity_id));
create policy "comments: writers create as self" on public.comments for insert to authenticated
with check(author_id = auth.uid() and public.has_project_role(project_id,auth.uid(),array['owner','member']::public.project_role[])
  and public.can_read_discussion(project_id,entity_type,entity_id));
create policy "comments: authors edit" on public.comments for update to authenticated
using(author_id = auth.uid() and public.has_project_role(project_id,auth.uid(),array['owner','member']::public.project_role[])
  and public.can_read_discussion(project_id,entity_type,entity_id))
with check(author_id = auth.uid() and public.has_project_role(project_id,auth.uid(),array['owner','member']::public.project_role[])
  and public.can_read_discussion(project_id,entity_type,entity_id));
create policy "comments: authors or owners delete" on public.comments for delete to authenticated
using(public.can_read_discussion(project_id,entity_type,entity_id) and
  (public.has_project_role(project_id,auth.uid(),array['owner']::public.project_role[]) or
    (author_id = auth.uid() and public.has_project_role(project_id,auth.uid(),array['member']::public.project_role[]))));
create index comments_record_idx on public.comments(project_id,entity_type,entity_id,created_at,id);

create table public.mentions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  mentioned_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(comment_id,mentioned_user_id)
);
grant select on public.mentions to authenticated;
grant all on public.mentions to service_role;
alter table public.mentions enable row level security;
create policy "mentions: comment readers" on public.mentions for select to authenticated
using(exists(select 1 from public.comments c where c.id = comment_id and c.project_id = mentions.project_id));
create index mentions_user_idx on public.mentions(project_id,mentioned_user_id);

-- Stable mention encoding: @[display name](user UUID). Render as text/chips, never HTML.
-- Keep mentions synchronized atomically on every comment write, including direct Data API calls.
create or replace function public.comments_integrity() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (new.project_id <> old.project_id or new.entity_type <> old.entity_type
    or new.entity_id <> old.entity_id or new.author_id <> old.author_id or new.created_at <> old.created_at)
  then raise exception 'Comment identity cannot change'; end if;
  if not public.can_read_discussion(new.project_id,new.entity_type,new.entity_id) then raise exception 'Record not found or not accessible'; end if;
  if tg_op = 'UPDATE' then
    new.edited_at := case when new.body is distinct from old.body then now() else old.edited_at end;
  else new.edited_at := null; end if;
  return new;
end $$;
create trigger comments_integrity before insert or update on public.comments for each row execute function public.comments_integrity();
create trigger comments_updated_at before update on public.comments for each row execute function public.set_updated_at();
create trigger comments_activity after insert or update or delete on public.comments for each row execute function public.log_activity();
create trigger mentions_updated_at before update on public.mentions for each row execute function public.set_updated_at();
create trigger mentions_activity after insert or update or delete on public.mentions for each row execute function public.log_activity();

create or replace function public.sync_comment_mentions() returns trigger
language plpgsql security definer set search_path = public as $$
declare _uid uuid; _ids uuid[] := '{}'::uuid[]; m text[];
begin
  for m in select regexp_matches(new.body, '@\[[^\]\r\n]+\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)', 'g') loop
    _uid := m[1]::uuid;
    if not public.is_project_member(new.project_id,_uid) then raise exception 'Mentioned person must be active on the project'; end if;
    _ids := array_append(_ids,_uid);
  end loop;
  delete from public.mentions where comment_id = new.id and not(mentioned_user_id = any(_ids));
  insert into public.mentions(project_id,comment_id,mentioned_user_id)
  select new.project_id,new.id,x from (select distinct unnest(_ids) as x) ids on conflict(comment_id,mentioned_user_id) do nothing;
  return new;
end $$;
create trigger comments_sync_mentions after insert or update of body on public.comments
for each row execute function public.sync_comment_mentions();

-- Append-only defense: no ordinary client may insert/update/delete audit rows.
revoke insert, update, delete, truncate on public.activity_log from anon, authenticated;
-- Remove ANY accidentally introduced client write policy, regardless of its name.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'activity_log' and cmd <> 'SELECT' loop
    execute format('drop policy %I on public.activity_log',p.policyname);
  end loop;
end $$;
-- Stakeholders get only risk/issue record history, never project-wide audit access or task history.
create policy "activity: stakeholders risk and issue history" on public.activity_log for select to authenticated
using(public.has_project_role(project_id,auth.uid(),array['stakeholder']::public.project_role[]) and (
  (entity_type = 'risks' and public.can_read_discussion(project_id,'risk',entity_id)) or
  (entity_type = 'issues' and public.can_read_discussion(project_id,'issue',entity_id))
));
create index activity_record_time_idx on public.activity_log(project_id,entity_type,entity_id,created_at desc,id);
create index activity_actor_time_idx on public.activity_log(project_id,actor_id,created_at desc,id);
