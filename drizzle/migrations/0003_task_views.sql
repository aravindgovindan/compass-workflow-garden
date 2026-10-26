create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null,
  name text not null check (char_length(name) between 1 and 80),
  view_type text not null default 'list' check (view_type in ('list', 'board')),
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id, name)
);
create index saved_views_project_user_idx on public.saved_views (project_id, user_id);

create table public.user_view_prefs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null,
  view_mode text not null default 'list' check (view_mode in ('list', 'board')),
  list_columns jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id)
);

grant select, insert, update, delete on public.saved_views to authenticated;
grant all on public.saved_views to service_role;
grant select, insert, update, delete on public.user_view_prefs to authenticated;
grant all on public.user_view_prefs to service_role;

alter table public.saved_views enable row level security;
alter table public.user_view_prefs enable row level security;

create policy "saved_views: own read" on public.saved_views for select to authenticated
  using (user_id = auth.uid() and public.is_project_member(project_id, auth.uid()));
create policy "saved_views: own insert" on public.saved_views for insert to authenticated
  with check (user_id = auth.uid() and public.project_role_of(project_id, auth.uid())::text in ('owner', 'member'));
create policy "saved_views: own update" on public.saved_views for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.project_role_of(project_id, auth.uid())::text in ('owner', 'member'));
create policy "saved_views: own delete" on public.saved_views for delete to authenticated
  using (user_id = auth.uid());

create policy "view_prefs: own read" on public.user_view_prefs for select to authenticated
  using (user_id = auth.uid() and public.is_project_member(project_id, auth.uid()));
create policy "view_prefs: own insert" on public.user_view_prefs for insert to authenticated
  with check (user_id = auth.uid() and public.project_role_of(project_id, auth.uid())::text in ('owner', 'member'));
create policy "view_prefs: own update" on public.user_view_prefs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger saved_views_updated_at before update on public.saved_views for each row execute function public.set_updated_at();
create trigger user_view_prefs_updated_at before update on public.user_view_prefs for each row execute function public.set_updated_at();
create trigger saved_views_activity after insert or update or delete on public.saved_views for each row execute function public.log_activity();

create index if not exists tasks_project_status_position_idx on public.tasks (project_id, status_id, position);
create index if not exists tasks_project_phase_idx on public.tasks (project_id, phase_id);
create index if not exists task_labels_label_idx on public.task_labels (label_id);