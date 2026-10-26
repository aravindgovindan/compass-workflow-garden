import type { ProjectRole } from "@/lib/auth/roles";
export type ExportKind = "task" | "milestone" | "risk" | "issue";
export function canExport(role: ProjectRole | null, kind: ExportKind) {
  return role === "owner" || role === "member" || (role === "stakeholder" && kind !== "task");
}
export function assertCanExport(role: ProjectRole | null, kind: ExportKind) {
  if (!canExport(role, kind)) throw new Error("You cannot export these records.");
}
export function csvCell(value: unknown): string {
  let text =
    value == null
      ? ""
      : Array.isArray(value)
        ? value.join("; ")
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}
export function csvFile(headers: readonly string[], rows: readonly (readonly unknown[])[]) {
  return (
    "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n"
  );
}
