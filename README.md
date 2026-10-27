# Compass Workflow

Build a web app called Compass Workflow, step by step.

PRODUCT
A lightweight, configurable project management tool supporting multiple projects per account. Unlike Jira, it is opinionated and simple: the owner configures workflow, terminology and custom fields in minutes, then manages tasks, milestones, risks and issues in one place. Target: small teams of 2 to 30 people per project.

USER ROLES
- Owner: full access, configures the project.
- Member: creates and updates work, comments.
- Stakeholder: read-only access to dashboard, milestones, risks and issues.

PHASE 1 FEATURES (build only these)
1. Authentication and role-based access.
2. Project profile: name, code, description, objectives, sponsor, start and target end dates, status, health (Green/Amber/Red).
3. Configuration engine: editable workflow statuses, editable terminology (e.g. Task -> Story, Milestone -> Gate), editable priorities and labels, and custom fields (text, number, date, dropdown, multi-select, user, checkbox, URL).
4. Tasks: title, description, assignee, reporter, status, priority, start date, due date, estimate, labels, custom fields; hierarchy of phases, tasks, sub-tasks and checklists.
5. Milestones with linked tasks and automatic percent complete.
6. Views: list/table view and Kanban board; search, filter and sort.
7. Team and collaboration: team directory, comments with @mentions, activity log.
8. Risk register and issue log.
9. Dashboard (health, percent complete, tasks by status, overdue items, upcoming milestones, open risks and issues) and CSV export.

NOT IN PHASE 1 (do not build, but do not block them): task dependencies, Gantt, calendar, notifications, templates, automation, time tracking, AI features, integrations. Multi-project support was added after Phase 1.

ARCHITECTURE RULES
- Project data is scoped by project_id; active membership and project-specific roles are validated on every server request.
- Everything configurable lives in the database and is never hard-coded in the UI. All labels come from the terminology map.
- Custom fields: store typed field definitions, and store values in a JSONB column on the record.
- Enforce authorization on the server for every read and write, based on role.
- Write an activity log entry for every create, update and delete.
- Validate all input with Zod on the server.

TECH STACK
TanStack Start v1 (React 19) + TypeScript, Vite, Tailwind CSS, shadcn/ui, Lovable Cloud (PostgreSQL and Auth), Zod, dnd-kit and TanStack Table. Server functions run on Edge Workers. Database changes are plain SQL, applied through the managed migration tool; there are no Drizzle ORM models.

APP STRUCTURE (routes)
/login, /setup (first-run wizard), /dashboard, /tasks (list and board toggle, task detail drawer), /milestones, /risks, /issues, /team, /activity, /settings (project, workflow, terminology, lists, custom fields).

DEVELOPMENT DIRECTION
- I will send one prompt per step. Never build ahead of the current step.
- At the end of each step: list files changed, explain key decisions, and give me a short test checklist.
- Ask at most 3 clarifying questions, and only if you are blocked. Otherwise state your assumptions and proceed.
- Quality bar: typed code, small reusable components, loading, empty and error states, responsive layout, keyboard accessible, sensible defaults, seed data for demo.

YOUR FIRST RESPONSE
Do not write code yet. Reply with: (a) your understanding in 5 lines, (b) the proposed database schema, (c) the folder structure, (d) a numbered build plan matching the steps I will send. Then wait for my approval.

This project was built with [Lovable](https://lovable.dev).

## Phase 1 hardening and demo data

Owners can open Settings → Demo data to load a customer onboarding launch dataset: 40 tasks (32 top-level and 8 sub-tasks), 3 phases, 4 milestones, 8 risks, 5 issues, 20 checklist entries and 6 comments with mentions. Dates are relative to the UTC load date. Existing workflow statuses, priorities, terminology and custom fields are used.

Reloading does not duplicate records. Remove demo data deletes only tracked demo records, retaining real work, settings, members and append-only history. Newly added comments on demo records must be removed first. A demo-only project becomes blank after removal.

See [Phase 1 permission audit](docs/phase1-audit.md) for every endpoint, live RLS policy, fixes, changed files and the three-role checklist. Run `bun test` for unit and live policy-regression tests; live checks require the test environment’s database connection and skip when it is unavailable.

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ce551831-bf40-4c33-8a71-fcd3ae142982).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
