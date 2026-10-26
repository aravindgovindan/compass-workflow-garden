import { z } from "zod";
import { fallback } from "@tanstack/zod-adapter";

/** URL search params for /tasks. Lenient: bad values fall back instead of throwing. */
const strList = fallback(z.array(z.string()), []).default([]);
const optStr = fallback(z.string().optional(), undefined);

export const taskSearchSchema = z.object({
  task: optStr,
  q: fallback(z.string(), "").default(""),
  status: strList,
  assignee: strList,
  priority: strList,
  label: strList,
  phase: strList,
  dueFrom: optStr,
  dueTo: optStr,
  overdue: fallback(z.boolean(), false).default(false),
  cf: fallback(z.record(z.string(), z.string()), {}).default({}),
  sort: fallback(z.string(), "").default(""),
  dir: fallback(z.string(), "asc").default("asc"),
  group: fallback(z.string(), "phase").default("phase"),
});
export type TaskSearch = z.infer<typeof taskSearchSchema>;

export const GROUP_BY = ["none", "status", "assignee", "phase", "priority"] as const;
export type GroupBy = (typeof GROUP_BY)[number];
export const NO_ASSIGNEE = "none";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CF_KEY = /^[a-z][a-z0-9_]{0,49}$/;

/** Parse raw URL params (strings, arrays, JSON) into a safe, typed search object. */
export function parseTaskSearch(raw: Record<string, unknown>): TaskSearch {
  const r = taskSearchSchema.parse(raw);
  const ids = (a: string[]) => [...new Set(a.filter((x) => UUID.test(x)))];
  const cf: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.cf)) if (CF_KEY.test(k) && v.trim()) cf[k] = v.slice(0, 200);
  return {
    ...r,
    task: r.task && UUID.test(r.task) ? r.task : undefined,
    q: r.q.slice(0, 200),
    status: ids(r.status), priority: ids(r.priority), label: ids(r.label), phase: ids(r.phase),
    assignee: [...new Set(r.assignee.filter((x) => x === NO_ASSIGNEE || UUID.test(x)))],
    dueFrom: r.dueFrom && DATE.test(r.dueFrom) ? r.dueFrom : undefined,
    dueTo: r.dueTo && DATE.test(r.dueTo) ? r.dueTo : undefined,
    cf,
    dir: r.dir === "desc" ? "desc" : "asc",
    group: (GROUP_BY as readonly string[]).includes(r.group) ? r.group : "phase",
    sort: r.sort.slice(0, 60),
  };
}

/** Filters only (what the server needs and what a saved view stores, besides sort/group). */
export type TaskFilters = Pick<TaskSearch, "q" | "status" | "assignee" | "priority" | "label" | "phase" | "dueFrom" | "dueTo" | "overdue" | "cf">;

export function toFilters(s: TaskSearch): TaskFilters {
  return { q: s.q, status: s.status, assignee: s.assignee, priority: s.priority, label: s.label, phase: s.phase,
    dueFrom: s.dueFrom, dueTo: s.dueTo, overdue: s.overdue, cf: s.cf };
}

export function activeFilterCount(f: TaskFilters): number {
  return [f.q, f.status.length, f.assignee.length, f.priority.length, f.label.length, f.phase.length, f.dueFrom, f.dueTo, f.overdue]
    .filter(Boolean).length + Object.keys(f.cf).length;
}

/** The part of the URL a saved view stores (no open task). */
export function viewState(s: TaskSearch): Omit<TaskSearch, "task"> {
  const { task: _t, ...rest } = s;
  return rest;
}
