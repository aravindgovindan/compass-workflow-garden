# Compass Workflow — Phase 1 Blueprint

## (a) Understanding
1. Compass Workflow is a simple, opinionated project tool for one project at a time, built for teams of 2 to 30 people.
2. Three roles: Owner configures everything, Member creates and updates work, Stakeholder gets read-only access to the dashboard, milestones, risks and issues.
3. All labels, statuses, priorities, terminology and custom fields come from the database. Nothing is hard-coded.
4. Core work items: phases, tasks, sub-tasks and checklists, plus milestones, risks and issues, each with comments, @mentions and an activity log.
5. Every table is scoped by project_id, every read and write is authorized on the server and validated with Zod, and every change is logged.

## Stack adjustments (assumptions, please confirm)
This platform runs a fixed stack, so a few of your choices map to equivalents:

| You asked for | What we use instead | Effect |
|---|---|---|
| Next.js App Router | TanStack Start (React 19, file routes, server functions) | Same routes and server-side logic |
| Supabase + Drizzle | Lovable Cloud (Postgres, Auth) with the generated typed client, SQL migrations and RLS | Types come from the generated schema; no Drizzle |
| Vercel | Lovable hosting (edge workers) | One-click publish |
| Tailwind, shadcn/ui, Zod, dnd-kit, TanStack Table | Used as you asked | No change |

Authorization is enforced twice: Row Level Security in the database, plus a role check and Zod validation in every server function. Activity logging uses database triggers, so no write can skip it.

## (b) Database schema (public schema; every table has project_id)

```text
projects            id, name, code, description, objectives, sponsor, start_date,
                    target_end_date, status, health(green|amber|red), created_by, timestamps
profiles            id(=auth user), full_name, avatar_url, job_title
project_members     id, project_id, user_id, role(owner|member|stakeholder), unique(project_id,user_id)
-- configuration
workflow_statuses   id, project_id, entity(task|risk|issue), key, label, color,
                    category(todo|in_progress|done), sort_order, is_default
priorities          id, project_id, key, label, color, sort_order, is_default
labels              id, project_id, name, color
terminology         id, project_id, key(task|subtask|phase|milestone|risk|issue|checklist...),
                    singular, plural
custom_field_defs   id, project_id, entity(task|milestone|risk|issue), key, label,
                    type(text|number|date|dropdown|multiselect|user|checkbox|url),
                    options jsonb, required, sort_order, archived
-- work
phases              id, project_id, name, description, sort_order, start_date, end_date
tasks               id, project_id, phase_id, parent_task_id(null = task, set = sub-task),
                    milestone_id, number(per project), title, description, assignee_id,
                    reporter_id, status_id, priority_id, start_date, due_date,
                    estimate numeric, sort_order, custom_values jsonb, timestamps
task_labels         task_id, label_id, project_id
checklist_items     id, project_id, task_id, text, is_done, sort_order
milestones          id, project_id, name, description, due_date, status, custom_values jsonb
                    (percent complete is calculated by a view: done linked tasks / all linked tasks)
risks               id, project_id, title, description, owner_id, status_id, probability(1-5),
                    impact(1-5), score(generated), mitigation, due_date, custom_values jsonb
issues              id, project_id, title, description, owner_id, status_id, priority_id,
                    severity, resolution, due_date, custom_values jsonb
-- collaboration
comments            id, project_id, entity_type, entity_id, author_id, body, timestamps
mentions            id, project_id, comment_id, user_id
activity_log        id, project_id, actor_id, entity_type, entity_id, action(create|update|delete),
                    changes jsonb (before/after diff), created_at
```

- Roles live only in project_members, and a security-definer function project_role(project_id) is used by all RLS policies. Stakeholders can read only projects, milestones, risks, issues, the dashboard view and the configuration tables needed for labels.
- Custom field values are stored in custom_values jsonb and validated on the server against a Zod schema built from custom_field_defs.
- Seed: a demo project with default statuses, priorities, terminology, sample phases, tasks, milestones, risks, issues and comments.
- Future work (dependencies, time tracking, more projects) only needs new tables. Nothing here would have to be reworked.

## (c) Folder structure

```text
src/
  routes/
    __root.tsx            index.tsx (redirect)   login.tsx   setup.tsx
    _authenticated/
      route.tsx           (managed gate + app shell: sidebar, header)
      dashboard.tsx  tasks.tsx  milestones.tsx  risks.tsx  issues.tsx
      team.tsx  activity.tsx
      settings.tsx  settings.project.tsx  settings.workflow.tsx
      settings.terminology.tsx  settings.lists.tsx  settings.custom-fields.tsx
  server/                 *.functions.ts per domain (projects, config, tasks,
                          milestones, risks, issues, comments, team, activity, export)
  lib/
    schemas/              Zod schemas shared by client and server
    auth/                 role helpers, requireRole middleware
    custom-fields/        def -> Zod builder, renderers, formatters
    terminology/          useTerm() hook + provider
    csv.ts
  components/
    ui/ (shadcn)  layout/  common/ (EmptyState, ErrorState, Loading, ConfirmDialog)
    tasks/ (TaskTable, KanbanBoard, TaskDrawer, Checklist, FilterBar)
    milestones/ risks/ issues/ team/ comments/ (MentionInput) activity/ dashboard/ settings/
supabase/migrations/      schema, RLS, triggers, seed
```

## (d) Build plan (one step per prompt)
1. Foundation: enable Cloud, design system, app shell, sign-in, profiles, project_members and roles, route guards.
2. Project profile and the /setup first-run wizard (creates the project and default config, and makes the creator Owner).
3. Configuration engine: workflow, terminology, priorities and labels, custom field definitions, plus the terminology hook used everywhere.
4. Tasks core: phases, tasks, sub-tasks, checklists, custom field values, and the task detail drawer.
5. Views: TanStack Table list and dnd-kit Kanban, with search, filter and sort.
6. Milestones with linked tasks and automatic percent complete.
7. Risk register and issue log.
8. Team directory, comments with @mentions, activity log page (triggers are added from step 1 onward).
9. Dashboard widgets and CSV export.
10. Hardening: seed data for the demo, access audit for each role, empty, loading and error states, responsive and keyboard checks, tests.

Each step ends with the files changed, key decisions and a test checklist.
