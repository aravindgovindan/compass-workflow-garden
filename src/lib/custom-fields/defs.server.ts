import type { Db } from "@/lib/project-access.server";
import type { CustomFieldDef, CustomFieldEntity, CustomFieldType, CustomValues } from "./types";
import { validateCustomValues } from "./validate";

export async function loadDefs(supabase: Db, projectId: string, entity: CustomFieldEntity): Promise<CustomFieldDef[]> {
  const { data, error } = await supabase.from("custom_field_defs").select("*").eq("project_id", projectId).eq("entity_type", entity);
  if (error) throw new Error("Could not load custom fields. Please try again.");
  return (data ?? []).map((d) => ({
    id: d.id, key: d.key, name: d.name, type: d.type as CustomFieldType, required: d.required, archived: d.archived,
    default_value: d.default_value, options: Array.isArray(d.options) ? (d.options as unknown[]).map(String) : [],
  }));
}

/**
 * Validate custom values for a write. On create, defaults fill gaps and "required" is not enforced yet
 * (records start from a title); on update the merged values must satisfy every rule. null clears a value.
 */
export async function checkCustomValues(
  supabase: Db, projectId: string, entity: CustomFieldEntity, stored: CustomValues, patch: CustomValues, mode: "create" | "update",
): Promise<CustomValues> {
  const [defs, members] = await Promise.all([
    loadDefs(supabase, projectId, entity),
    supabase.from("project_members").select("user_id").eq("project_id", projectId).eq("active", true),
  ]);
  const merged: CustomValues = { ...stored };
  if (mode === "create") for (const d of defs) if (d.default_value !== undefined && d.default_value !== null) merged[d.key] = d.default_value;
  for (const [k, v] of Object.entries(patch)) { if (v === null) delete merged[k]; else merged[k] = v; }
  const rules = mode === "create" ? defs.map((d) => ({ ...d, required: false })) : defs;
  const r = validateCustomValues(rules, merged, { memberIds: (members.data ?? []).map((m) => m.user_id) });
  if (!r.ok) throw new Error(Object.values(r.errors)[0] ?? "Check the custom fields.");
  return r.values;
}
