import { resolveTerm, type TermKey } from "@/lib/terminology/defaults";
import type { ProjectRole } from "@/lib/auth/roles";

export type GuideSection = {
  id: string;
  title: string;
  intro: string;
  steps: string[];
  note?: string;
};

const label = (key: TermKey) => resolveTerm(null, key);

export const guideRoles: { value: ProjectRole; title: string; summary: string }[] = [
  { value: "owner", title: "Owner", summary: "Set up the project, shape the workflow and manage your team." },
  { value: "member", title: "Member", summary: "Plan work, keep records current and collaborate with your team." },
  { value: "stakeholder", title: "Stakeholder", summary: "Follow progress, review key dates and monitor risks and issues." },
];

const start: GuideSection = {
  id: "getting-started", title: "Sign in and choose a project",
  intro: "Your role belongs to a project, not to your whole account. You may be an owner in one project and a member or stakeholder in another.",
  steps: [
    "From the home screen, choose Sign in. Use your email and password or an available social sign-in option. If you are new, create an account and complete any email verification requested.",
    "If you were invited, sign in using the invited email address after verifying it. Pending invitations are accepted when your session is loaded; the project then appears in your project list. Ask the owner to check the address if it is missing.",
    "Use the project name at the top of the sidebar to open the project switcher. Select a project and check its name and code before reading or changing records. Your selection is remembered when you return.",
    "The dashboard is the starting point for each project. Open the navigation using the menu icon on a smaller screen. Your account menu shows your role and provides Sign out.",
    "Before switching projects, finish any edits. Switching discards the previous project's open panels and local editing state. A link to a record does not switch projects for you: select the correct project first.",
  ],
  note: "This guide uses the default names. Your owner can rename entities—for example, Tasks may appear as Stories. Follow the equivalent labels in your project.",
};

const dashboard: GuideSection = {
  id: "dashboard", title: "Read the dashboard",
  intro: "The dashboard brings together the project's profile, health, dates, objectives and progress. Status describes its stage; health describes how well it is going.",
  steps: [
    "Check the project header first: name, code, status, health, start and target dates, and objectives give context to the numbers below.",
    "Overall completion counts work in a workflow status whose category is Done. Renaming a status does not change whether it counts as complete. An empty project displays zero percent.",
    "Compare work by status and assignee to see the distribution of work. Review the next five upcoming milestones, their dates and completion counts.",
    "Review open risks by rating and open issues by severity. Open the corresponding register to inspect individual records. Return to the dashboard to refresh the summary after changes elsewhere.",
  ],
};

const tasks: GuideSection = {
  id: "work", title: `Plan and update ${label("task").toLowerCase()}`,
  intro: "Use the list for scanning and comparison, and the board for moving work through your configured workflow. Owners and members can create, update and delete work.",
  steps: [
    "Open the work page and use Quick add to enter a title. Submit it, then open the record to fill in the details. Give each item a specific outcome rather than a vague topic.",
    "In the detail panel, update the description, status, priority, assignee, dates, estimate, labels, phase and milestone as needed. Inline changes save as you finish editing the field; wait for the change to finish before moving away.",
    "Fill in any custom fields your owner has configured. Required fields and field formats are validated; correct an error before retrying rather than assuming the edit saved.",
    "Add sub-tasks for separately trackable pieces of work. Only one level is supported: a sub-task cannot have its own sub-tasks. Use checklist items for smaller steps and mark them complete as you finish them.",
    "Choose List or Board. In List, choose the columns you need, including custom fields, sort by a column and group the work. Your view mode and column choices are personal preferences.",
    "In Board, drag a card to another status column to change its status, or reorder it within a column. Open a card to edit its full details. Use Show more when a column has more cards than initially displayed.",
    "Use search and filters to narrow work by status, assignee, priority, label, phase, milestone, due dates, overdue state or custom values. Clear filters when an expected item seems to be missing.",
    "Save a useful filter combination as a saved view. Load, rename or delete your own saved views; they are personal, not shared team settings. Search, filters, sorting and grouping are carried in the page link.",
    "Copy the page address while a detail panel is open to share that record with another authorized user. They must be in the same project and have permission to view it.",
    "Use the phase manager to create or rename phases, arrange their order and set dates. Assign records to phases and group the list by phase when planning stages of delivery.",
    "Use Delete only for records you no longer need. Deleting a parent also deletes its sub-tasks after confirmation. Completing work is usually a better choice than deleting historical work.",
  ],
  note: "Moving work into a Done-category status sets its completion time automatically; moving it out clears that time. If a save or board move fails, the screen restores the previous state—check the message and retry.",
};

const milestones: GuideSection = {
  id: "milestones", title: `Track ${label("milestone").toLowerCase()}`,
  intro: "Milestones represent delivery checkpoints. Their progress is calculated from linked work, including linked sub-tasks, rather than entered as a percentage.",
  steps: [
    "Open the milestone page to review checkpoints ordered by target date. Each entry shows its owner, status, progress bar and completed-versus-total counts.",
    "Owners and members can create a milestone with a name, description, target date and owner, then edit or delete it from its controls.",
    "Owners and members can link or unlink work from the milestone page or from a work item's detail panel. Follow the linked-work action to view the filtered list.",
    "Progress is completed linked work divided by all linked work. No linked work shows 0 of 0 and zero percent; it is not treated as achieved.",
    "Achieved means all linked work is complete. Missed means the target date has passed and work remains. At Risk means the target is within seven days and progress is below 80%. Otherwise the milestone is Upcoming.",
    "Only an owner can set a status override. An override takes precedence over the calculated status; clear it when you want the calculated status again. Deleting a milestone unlinks its work rather than deleting that work.",
  ],
};

const risks: GuideSection = {
  id: "risks", title: `Review ${label("risk").toLowerCase()}`,
  intro: "A risk is something that could go wrong. Its probability and impact determine its rating, so teams can compare exposure consistently.",
  steps: [
    "Open the risk register, search or filter records, and change sorting to focus on what needs attention. Open a row to inspect its description, category, owner, mitigation plan, status, review date and custom fields.",
    "Owners and members can add a risk, assign an owner, and score both probability and impact from 1 to 5. Record a concrete mitigation plan and review date.",
    "The score is probability multiplied by impact. Scores 1–4 are Low, 5–9 Medium, 10–14 High and 15–25 Critical. The score and rating are calculated automatically.",
    "Use Open for a newly identified exposure, Mitigating while action is under way, Closed when the exposure no longer needs monitoring, and Occurred when it has materialized.",
    "The 5 × 5 heatmap counts open and mitigating risks by probability and impact. Select a cell to filter the register to that combination; clear the cell or other filters to broaden the view.",
    "If a risk becomes a real problem, owners and members can use Convert to issue. This creates a linked issue and marks the risk Occurred together. Open the issue afterward to complete its owner, severity, target date and resolution plan.",
  ],
};

const issues: GuideSection = {
  id: "issues", title: `Follow ${label("issue").toLowerCase()}`,
  intro: "An issue is a problem that already exists and needs resolution. Keep its responsibility, target date and resolution clear.",
  steps: [
    "Open the issue register and use search, filters and sorting to find the relevant problems. Open a row to inspect its details and any link to the source risk.",
    "Owners and members can create an issue with a title and description, choose its severity and status, assign an owner and target date, and complete any configured custom fields.",
    "Update the issue as investigation or resolution progresses. Record the resolution so reviewers can understand what was done before you close it.",
    "Owners and members can edit or delete issues. Stakeholders can inspect the same register and details but cannot change any fields.",
  ],
};

const collaboration: GuideSection = {
  id: "collaboration", title: "Comments and change history",
  intro: "Record discussions alongside the work they refer to, so decisions remain connected to their context.",
  steps: [
    "Open a task, risk or issue detail panel and choose Comments. Owners and members can post comments; use the mention picker to refer to an active person in the project.",
    "Mentions identify people in the discussion but do not send notifications. Invitations also do not send a separate project invitation email: arrange access details with the person directly.",
    "You may edit or delete your own comments. An owner can delete another person's comment but cannot edit it on their behalf. Stakeholders can read risk and issue comments only and cannot post.",
    "Use the Activity tab in a record to inspect its change history. Owners and members can also open the project Activity page and filter the feed. Stakeholders see only history for accessible risks and issues.",
    "Activity is an append-only audit trail. It cannot be edited or deleted, including when demo data is removed.",
  ],
};

const exports: GuideSection = {
  id: "exports", title: "Export the current view",
  intro: "CSV exports are useful for review or reporting outside the app. They contain all records matching the supported current filters, not just the rows visible on screen.",
  steps: [
    "Open the relevant list, apply the filters you need and choose Export. Wait for the CSV download; on touch devices, choose Download CSV when it appears. Then open the file in your spreadsheet application. Milestones export the complete visible register because that page has no list filters.",
    "Owners and members can export tasks, milestones, risks and issues. Stakeholders can export milestones, risks and issues only; individual task data is not available to them.",
    "Task exports contain matching top-level tasks, not sub-tasks as separate rows. Headers use the project's configured terminology. Active custom fields appear as columns using their display names. Cells are escaped, and values beginning with spreadsheet formula characters are neutralized.",
    "Treat exported files as project information: share them only with the right people. Project access restrictions do not control a file after you download it.",
  ],
};

const troubleshooting: GuideSection = {
  id: "help", title: "When something is missing or fails",
  intro: "A missing control usually reflects your project role; a missing record may reflect the active project or current filters.",
  steps: [
    "Check the project name and your role in the account menu. Switch to the intended project, then clear list filters and search before concluding that a record is missing.",
    "If a section is unavailable, ask a real project owner to review your active membership and role. A shared test Owner cannot manage team membership.",
    "If a save fails, read the message, keep your entered information and correct validation errors. Retry after your connection returns. Do not assume a failed change was saved.",
    "Use the page's retry action when loading fails. If a shared record link cannot be opened, check the selected project, access permission and whether the record still exists.",
    "For a forgotten password, use Forgot password on the sign-in page and follow the reset email. If a test session ends, shared access may have been disabled or expired—check with the owner.",
  ],
};

const ownerSetup: GuideSection = {
  id: "setup", title: "Create and configure a project",
  intro: "Start with a small, understandable workflow. Configuration applies to the current project; it does not change your other projects.",
  steps: [
    "For your first project, complete the setup wizard: Basics, Goals, Timeline and Review. Enter a name and project code, description, objectives, sponsor, dates, status and health, then review and create. You become its owner.",
    "To create another project, open the sidebar project switcher and choose New project. Enter its name, code, optional description, status and health, then create it. The new project becomes your active project.",
    "During project creation, use a short uppercase project code and ensure the target end date is not before the start date. Settings currently provides workflow configuration, not a project-profile editing form.",
    "In workflow settings, add or edit statuses and arrange their order. Choose the appropriate category, especially Done for completed work. Status names are configurable; the category drives completion calculations.",
    "In Terminology, enter singular and plural labels for your team's entities. In Priorities and Labels, define the choices and colors you want people to use consistently.",
    "In Custom fields, choose the entity, name, field type and any required setting or choices. Field keys and types cannot change after creation. Archive unused fields instead of deleting them; existing values are preserved.",
    "Review the work pages after changing configuration to confirm that the intended choices and labels are available. Members and stakeholders cannot change Settings.",
  ],
};

const team: GuideSection = {
  id: "team", title: "Invite people and manage roles",
  intro: "Give each person the least access they need. Team management is reserved for real project owners.",
  steps: [
    "Open Team and choose Invite. Enter the person's email address and choose Owner, Member or Stakeholder. Share the sign-in address with them directly; there is no separate invitation-notification email.",
    "Ask them to create or sign in to an account with that email and complete verification. An invitation can grant access to another project without replacing their existing active project roles.",
    "Owners manage configuration and people as well as work. Members create and maintain work and comments. Stakeholders read the dashboard, milestones, risks and issues without editing.",
    "Use the person's role control to change access. You cannot demote or deactivate the last active owner; appoint another owner first.",
    "When deactivating a person, choose how to reassign or unassign their open tasks. Deactivation removes active project access but retains project records and history.",
    "Review pending invitations and cancel those no longer needed. Members can inspect the Team page but cannot invite, change roles or deactivate people.",
  ],
};

const demo: GuideSection = {
  id: "demo", title: "Demo data and shared test access",
  intro: "Demo records and shared test logins are separate tools. Loading sample records does not enable public test access.",
  steps: [
    "As a real owner, open Settings → Demo data and load the sample project content. It includes about 40 tasks across three phases, four milestones, eight risks, five issues, plus sub-tasks, checklists and discussion examples.",
    "Loading again does not duplicate the sample set. Samples use the project's configured choices and dates relative to the loading day.",
    "Use Remove demo data when you are finished, and review the confirmation. Only tracked demo records and edits to them are removed; real records, settings, memberships and audit history remain. Remove new comments on demo records first if removal is blocked. This is not an action to erase all project data.",
    "In Settings → Test access, set up the shared role accounts, then enable access. It is off by default. Add an optional expiry and feedback address, and share the sign-in page with testers.",
    "Testers choose a test project when more than one is offered, then choose Owner, Member or Stakeholder. A persistent banner identifies the shared role and offers role switching, feedback when configured and exit.",
    "Only real owners may manage test access, set up or recreate its accounts, and load or remove demo data. The shared Owner may test ordinary configuration but cannot manage people or invitations, create projects, or change protected project or account identity details.",
    "Turn off test access to end testing. Disabled or expired access is rejected on the next request, including for an already signed-in tester. Ordinary real-user sign-in is unaffected.",
    "Shared accounts are reused by testers, so edits are visible to others using them. Do not use them for private work. Login attempts are limited to five per minute per IP; wait a minute if repeated attempts are refused.",
  ],
};

const stakeholderReview: GuideSection = {
  id: "review", title: "Your read-only review routine",
  intro: "Your view is designed for oversight without exposing individual task records or giving editing access.",
  steps: [
    "Start at Dashboard. Review the project's health and dates, completion percentage, work-by-status and work-by-assignee summaries. These are aggregates, not access to individual tasks.",
    "Open Milestones and inspect each date, owner, status and completed-versus-total count. You cannot open linked task details, link work, edit a milestone or set an override.",
    "Open Risks and Issues to search, filter and sort the registers. Inspect details, custom fields, comments and accessible record history. Use the risk heatmap to focus on a probability-impact combination.",
    "Download filtered milestone, risk or issue CSVs when you need a review pack. Task export is not available to your role.",
    "Raise questions with your project owner outside the app. Your role cannot post comments, change records or convert a risk into an issue.",
    "The task page, Team, project Activity and Settings are unavailable. The dashboard omits individual overdue task titles and recent project activity. Ask an owner if your responsibilities require a different role.",
  ],
};

export function sectionsForRole(role: ProjectRole): GuideSection[] {
  if (role === "owner") return [start, ownerSetup, team, dashboard, tasks, milestones, risks, issues, collaboration, exports, demo, troubleshooting];
  if (role === "member") return [start, { ...dashboard, steps: [...dashboard.steps, "Review overdue work and the recent project activity feed. Open the related work page to take action on items assigned to you."] }, tasks, milestones, risks, issues, collaboration, exports, {
    id: "member-boundaries", title: "Work within your role",
    intro: "You can maintain project work, but project configuration and access belong to the owner.",
    steps: ["You can create, edit and delete tasks, phases, milestones, risks and issues, and participate in task, risk and issue comments.", "You can view Team and project Activity but cannot invite people, change roles or deactivate membership. Ask an owner to update workflow choices, labels, terminology or custom fields.", "You cannot set milestone status overrides, change Settings, load or remove demo data, or manage shared test access. Your saved views and list preferences remain personal."],
  }, troubleshooting];
  return [start, dashboard, stakeholderReview, {
    ...milestones, steps: [...milestones.steps.slice(0, 1), ...milestones.steps.slice(3, 5), "A status override set by an owner takes precedence over the calculated status. Your milestone view is read-only; individual linked work remains restricted."],
  }, { ...risks, steps: [...risks.steps.slice(0, 1), ...risks.steps.slice(2, 5), "Read mitigation plans, ownership and review dates. You cannot add or edit risks, change scores, delete records or convert risks into issues."] }, {
    ...issues, steps: [...issues.steps.slice(0, 1), "Read the severity, status, owner, target date, resolution and custom fields. Comments and the issue's history provide context; you cannot create, edit, delete or comment."],
  }, exports, troubleshooting];
}