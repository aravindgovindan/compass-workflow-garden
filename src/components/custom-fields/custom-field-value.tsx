import type { CustomFieldDef } from "@/lib/custom-fields/types";

/** Read-only display of a custom field value. */
export function CustomFieldValue({
  def,
  value,
  members = [],
}: {
  def: CustomFieldDef;
  value: unknown;
  members?: { user_id: string; full_name: string }[];
}) {
  const empty = <span className="text-muted-foreground">—</span>;
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) {
    return def.type === "checkbox" ? <span>No</span> : empty;
  }
  switch (def.type) {
    case "checkbox":
      return <span>{value === true ? "Yes" : "No"}</span>;
    case "date":
      return <span>{new Date(`${String(value)}T00:00:00`).toLocaleDateString()}</span>;
    case "number":
      return <span className="tabular-nums">{Number(value).toLocaleString()}</span>;
    case "url":
      return (
        <a href={String(value)} target="_blank" rel="noreferrer noopener" className="text-primary underline-offset-4 hover:underline">
          {String(value)}
        </a>
      );
    case "user":
      return <span>{members.find((m) => m.user_id === value)?.full_name ?? "Unknown person"}</span>;
    case "multi_select":
      return (
        <span className="flex flex-wrap gap-1">
          {(value as string[]).map((v) => (
            <span key={v} className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">{v}</span>
          ))}
        </span>
      );
    case "long_text":
      return <span className="whitespace-pre-wrap">{String(value)}</span>;
    default:
      return <span>{String(value)}</span>;
  }
}
