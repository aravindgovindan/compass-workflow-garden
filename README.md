# Compass Workflow

Build a web app called Compass Workflow, step by step.

PRODUCT
A lightweight, configurable project management tool for running ONE project at a time. Unlike Jira, it is opinionated and simple: the owner configures workflow, terminology and custom fields in minutes, then manages tasks, milestones, risks and issues in one place. Target: small teams of 2 to 30 people.

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

NOT IN PHASE 1 (do not build, but do not block them): task dependencies, Gantt, calendar, notifications, templates, automation, time tracking, AI features, integrations, multi-project UI.

ARCHITECTURE RULES
- Every table has a project_id so multi-project support can be added later, even though the UI shows a single project.
- Everything configurable lives in the database and is never hard-coded in the UI. All labels come from the terminology map.
- Custom fields: store typed field definitions, and store values in a JSONB column on the record.
- Enforce authorization on the server for every read and write, based on role.
- Write an activity log entry for every create, update and delete.
- Validate all input with Zod on the server.

TECH STACK
Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui, PostgreSQL via Supabase, Drizzle ORM, Supabase Auth, Zod, dnd-kit for drag and drop, TanStack Table for the list view. Deployable to Vercel.

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
