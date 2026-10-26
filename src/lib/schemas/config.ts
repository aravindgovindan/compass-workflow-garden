import { z } from "zod";
import { CONFIG_COLORS } from "@/lib/config/colors";
import { EDITABLE_TERM_KEYS } from "@/lib/terminology/defaults";
import { CUSTOM_FIELD_ENTITIES, CUSTOM_FIELD_TYPES, TYPES_WITH_OPTIONS } from "@/lib/custom-fields/types";

const id = z.string().uuid();
const name = z.string().trim().min(1, "Name is required").max(40, "40 characters max");
const color = z.enum(CONFIG_COLORS);

export const STATUS_CATEGORIES = ["todo", "in_progress", "done"] as const;
export const STATUS_CATEGORY_LABELS = { todo: "To do", in_progress: "In progress", done: "Done" } as const;

export const statusInput = z.object({ name, color, category: z.enum(STATUS_CATEGORIES) });
export const statusUpdate = statusInput.partial().extend({ id, is_default: z.literal(true).optional() });
export const statusDelete = z.object({ id, replacementId: id.nullish() });

export const priorityInput = z.object({ name, color });
export const priorityUpdate = priorityInput.partial().extend({ id });

export const labelInput = z.object({ name, color });
export const labelUpdate = labelInput.partial().extend({ id });

export const reorderInput = z.object({
  kind: z.enum(["status", "priority", "custom_field"]),
  ids: z.array(id).min(1).max(200),
});
export const deleteById = z.object({ id });

const termLabel = z.string().trim().min(1, "Required").max(40, "40 characters max");
export const terminologyInput = z.object({
  terms: z
    .array(z.object({ key: z.enum(EDITABLE_TERM_KEYS), singular: termLabel, plural: termLabel }))
    .min(1),
});

const fieldBase = z.object({
  name: z.string().trim().min(1, "Name is required").max(60, "60 characters max"),
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{0,39}$/, "Lowercase letters, numbers and _ only, starting with a letter"),
  type: z.enum(CUSTOM_FIELD_TYPES),
  options: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  required: z.boolean().default(false),
  default_value: z.unknown().optional(),
});

function checkOptions<T extends { type?: string; options?: string[] }>(v: T, ctx: z.RefinementCtx) {
  if (v.type && TYPES_WITH_OPTIONS.includes(v.type as never)) {
    const opts = v.options ?? [];
    if (opts.length === 0) ctx.addIssue({ code: "custom", path: ["options"], message: "Add at least one option" });
    if (new Set(opts).size !== opts.length) ctx.addIssue({ code: "custom", path: ["options"], message: "Options must be unique" });
  }
}

export const customFieldCreate = fieldBase.extend({ entity_type: z.enum(CUSTOM_FIELD_ENTITIES) }).superRefine(checkOptions);
/** Key and type are fixed after creation so stored values stay valid. */
export const customFieldUpdate = fieldBase
  .omit({ key: true, type: true })
  .partial()
  .extend({ id, archived: z.boolean().optional() });

/** Suggest a field key from its name, e.g. "Cost Centre" -> "cost_centre". */
export function suggestFieldKey(name: string): string {
  const k = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[0-9_]+/, "");
  return k.slice(0, 40);
}
