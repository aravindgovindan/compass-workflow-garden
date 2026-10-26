import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CustomFieldDef } from "@/lib/custom-fields/types";

type Member = { user_id: string; full_name: string };

/** Renders the right input for any custom field definition. */
export function CustomFieldInput({
  def,
  value,
  onChange,
  members = [],
  error,
}: {
  def: CustomFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  members?: Member[];
  error?: string | undefined;
}) {
  const id = `cf-${def.key}`;
  const describedBy = error ? `${id}-err` : undefined;
  const common = { id, "aria-invalid": !!error, "aria-describedby": describedBy };
  let control: React.ReactNode;

  switch (def.type) {
    case "text":
      control = <Input {...common} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "long_text":
      control = <Textarea {...common} rows={3} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "number":
      control = (
        <Input {...common} type="number" inputMode="decimal" value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
      );
      break;
    case "date":
      control = <Input {...common} type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || null)} />;
      break;
    case "url":
      control = <Input {...common} type="url" placeholder="https://" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "checkbox":
      control = (
        <div className="flex h-9 items-center">
          <Checkbox {...common} checked={value === true} onCheckedChange={(c) => onChange(c === true)} />
        </div>
      );
      break;
    case "dropdown":
    case "user": {
      const opts = def.type === "user"
        ? members.map((m) => ({ v: m.user_id, l: m.full_name }))
        : def.options.map((o) => ({ v: o, l: o }));
      control = (
        <Select value={(value as string) ?? ""} onValueChange={(v) => onChange(v)}>
          <SelectTrigger {...common}><SelectValue placeholder={def.type === "user" ? "Choose a person" : "Choose…"} /></SelectTrigger>
          <SelectContent>
            {opts.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
          </SelectContent>
        </Select>
      );
      break;
    }
    case "multi_select": {
      const sel = Array.isArray(value) ? (value as string[]) : [];
      control = (
        <div role="group" aria-labelledby={`${id}-label`} aria-describedby={describedBy} className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
          {def.options.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <Checkbox checked={sel.includes(o)} onCheckedChange={(c) => onChange(c ? [...sel, o] : sel.filter((x) => x !== o))} />
              {o}
            </label>
          ))}
        </div>
      );
      break;
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={def.type === "multi_select" ? undefined : id} id={`${id}-label`}>
        {def.name}
        {def.required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
      </Label>
      {control}
      {error && <p id={`${id}-err`} className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
