import { z } from "zod";

export const PROJECT_STATUSES = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
] as const;

export const PROJECT_HEALTH = [
  { value: "green", label: "Green", hint: "On track" },
  { value: "amber", label: "Amber", hint: "At risk, needs attention" },
  { value: "red", label: "Red", hint: "Off track, needs action" },
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine((v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date");

export const projectBasicsSchema = z.object({
  name: z.string().trim().min(2, "Give your project a name").max(120, "Keep it under 120 characters"),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,9}$/, "2–10 letters or numbers, starting with a letter (e.g. APOLLO)"),
  description: optionalText(2000),
});

export const projectGoalsSchema = z.object({
  objectives: optionalText(4000),
  sponsor: optionalText(120),
});

export const projectTimelineSchema = z.object({
  start_date: optionalDate,
  target_end_date: optionalDate,
  status: z.enum(["planning", "active", "on_hold", "completed"]),
  health: z.enum(["green", "amber", "red"]),
});

export const projectProfileSchema = projectBasicsSchema
  .merge(projectGoalsSchema)
  .merge(projectTimelineSchema)
  .refine((p) => !p.start_date || !p.target_end_date || p.target_end_date >= p.start_date, {
    message: "Target end date can't be before the start date",
    path: ["target_end_date"],
  });

export type ProjectProfileInput = z.input<typeof projectProfileSchema>;
export type ProjectProfile = z.output<typeof projectProfileSchema>;
