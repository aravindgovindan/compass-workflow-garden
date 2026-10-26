import type { CustomFieldDef, CustomValues } from "./types";

export type ValidationResult = { ok: boolean; values: CustomValues; errors: Record<string, string> };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isEmpty(v: unknown) {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

function checkOne(def: CustomFieldDef, v: unknown, memberIds?: Set<string>): { value?: unknown; error?: string } {
  switch (def.type) {
    case "text":
    case "long_text": {
      if (typeof v !== "string") return { error: "Must be text." };
      const max = def.type === "text" ? 255 : 5000;
      if (v.length > max) return { error: `Must be ${max} characters or fewer.` };
      return { value: v.trim() };
    }
    case "number": {
      const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
      if (typeof n !== "number" || !Number.isFinite(n)) return { error: "Must be a number." };
      return { value: n };
    }
    case "date": {
      if (typeof v !== "string" || !ISO_DATE.test(v) || Number.isNaN(Date.parse(v))) return { error: "Must be a valid date." };
      return { value: v };
    }
    case "dropdown": {
      if (typeof v !== "string" || !def.options.includes(v)) return { error: "Choose one of the listed options." };
      return { value: v };
    }
    case "multi_select": {
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || !def.options.includes(x)))
        return { error: "Choose only listed options." };
      return { value: [...new Set(v as string[])] };
    }
    case "user": {
      if (typeof v !== "string" || !UUID.test(v)) return { error: "Choose a person." };
      if (memberIds && !memberIds.has(v)) return { error: "That person is not on this project." };
      return { value: v };
    }
    case "checkbox": {
      if (typeof v !== "boolean") return { error: "Must be yes or no." };
      return { value: v };
    }
    case "url": {
      if (typeof v !== "string") return { error: "Must be a link." };
      try {
        const u = new URL(v);
        if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
      } catch {
        return { error: "Must be a valid http(s) link." };
      }
      return { value: v };
    }
  }
}

/**
 * Validate a custom values object against field definitions (server and client).
 * Unknown keys and archived fields are dropped; required fields must be filled
 * (a checkbox counts as filled when it is true or false).
 */
export function validateCustomValues(
  defs: CustomFieldDef[],
  values: CustomValues,
  opts: { memberIds?: string[] } = {},
): ValidationResult {
  const memberIds = opts.memberIds ? new Set(opts.memberIds) : undefined;
  const out: CustomValues = {};
  const errors: Record<string, string> = {};
  for (const def of defs) {
    if (def.archived) continue;
    const v = values[def.key];
    if (isEmpty(v)) {
      if (def.required) errors[def.key] = `${def.name} is required.`;
      continue;
    }
    const r = checkOne(def, v, memberIds);
    if (r.error) errors[def.key] = r.error;
    else out[def.key] = r.value;
  }
  return { ok: Object.keys(errors).length === 0, values: out, errors };
}
