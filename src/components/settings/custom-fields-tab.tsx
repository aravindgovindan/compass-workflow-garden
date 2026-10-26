import { useState } from "react";
import { Archive, ArchiveRestore, Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomFieldInput } from "@/components/custom-fields/custom-field-input";
import { CustomFieldValue } from "@/components/custom-fields/custom-field-value";
import { createCustomField, reorderConfig, updateCustomField, type ProjectConfig } from "@/functions/config.functions";
import { useConfigMutation } from "@/lib/config/use-config";
import { customFieldCreate, suggestFieldKey } from "@/lib/schemas/config";
import { CUSTOM_FIELD_ENTITIES, CUSTOM_FIELD_TYPES, FIELD_TYPE_LABELS, TYPES_WITH_OPTIONS, type CustomFieldEntity, type CustomFieldType, type CustomValues } from "@/lib/custom-fields/types";
import { validateCustomValues } from "@/lib/custom-fields/validate";
import { useTerm } from "@/lib/terminology/use-term";
import { SortableList } from "./sortable-list";
import { SavingNote } from "./shared";

type Field = ProjectConfig["customFields"][number];

export function CustomFieldsTab({ fields, members }: { fields: Field[]; members: ProjectConfig["members"] }) {
  const term = useTerm();
  const [entity, setEntity] = useState<CustomFieldEntity>("task");
  const [editing, setEditing] = useState<Field | "new" | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const update = useConfigMutation(updateCustomField);
  const reorder = useConfigMutation(reorderConfig);
  const forEntity = fields.filter((f) => f.entity_type === entity);
  const activeBase = forEntity.filter((f) => !f.archived);
  const active = order ? (order.map((id) => activeBase.find((f) => f.id === id)).filter(Boolean) as Field[]) : activeBase;
  const archived = forEntity.filter((f) => f.archived);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Custom fields</h2>
            <p className="text-sm text-muted-foreground">Extra fields on each record. Archiving hides a field but keeps its data.</p>
          </div>
          <SavingNote saving={update.isPending || reorder.isPending} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ToggleGroup type="single" variant="outline" value={entity} onValueChange={(v) => v && setEntity(v as CustomFieldEntity)} aria-label="Record type">
            {CUSTOM_FIELD_ENTITIES.map((e) => <ToggleGroupItem key={e} value={e} className="px-3">{term(e, "plural")}</ToggleGroupItem>)}
          </ToggleGroup>
          <Button onClick={() => setEditing("new")}><Plus /> Add field</Button>
        </div>
        {active.length ? (
          <SortableList
            items={active}
            onReorder={(ids) => { setOrder(ids); reorder.mutate({ kind: "custom_field", ids }, { onSettled: () => setOrder(null) }); }}
            renderItem={(f) => (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.name}{f.required && <span className="ml-1 text-xs text-muted-foreground">(required)</span>}</p>
                  <p className="text-xs text-muted-foreground">{FIELD_TYPE_LABELS[f.type]} · <code className="font-mono">{f.key}</code></p>
                </div>
                <Button variant="ghost" size="icon" aria-label={`Edit ${f.name}`} onClick={() => setEditing(f)}><Pencil className="text-muted-foreground" /></Button>
                <Button variant="ghost" size="icon" aria-label={`Archive ${f.name}`} onClick={() => update.mutate({ id: f.id, archived: true })}><Archive className="text-muted-foreground" /></Button>
              </>
            )}
          />
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No custom fields for {term(entity, "plural").toLowerCase()} yet.
          </p>
        )}
        {archived.length > 0 && (
          <details className="rounded-lg border bg-card px-3 py-2">
            <summary className="cursor-pointer text-sm text-muted-foreground">Archived ({archived.length})</summary>
            <ul className="mt-2 divide-y">
              {archived.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="text-muted-foreground">{f.name} · {FIELD_TYPE_LABELS[f.type]}</span>
                  <Button variant="ghost" size="sm" onClick={() => update.mutate({ id: f.id, archived: false })}><ArchiveRestore /> Restore</Button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <FieldPreview key={entity} fields={active} members={members} title={`Preview: new ${term(entity, "singular").toLowerCase()}`} />
      <FieldDialog entity={entity} field={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function FieldPreview({ fields, members, title }: { fields: Field[]; members: ProjectConfig["members"]; title: string }) {
  const [values, setValues] = useState<CustomValues>(() => Object.fromEntries(fields.filter((f) => f.default_value != null).map((f) => [f.key, f.default_value])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<CustomValues | null>(null);
  if (!fields.length) return null;
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">Try the form. Nothing here is saved.</p>
      </div>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const r = validateCustomValues(fields, values, { memberIds: members.map((m) => m.user_id) });
          setErrors(r.errors);
          setChecked(r.ok ? r.values : null);
        }}
      >
        {fields.map((f) => (
          <div key={f.id} className={f.type === "long_text" || f.type === "multi_select" ? "sm:col-span-2" : ""}>
            <CustomFieldInput def={f} value={values[f.key]} members={members} error={errors[f.key]}
              onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
          </div>
        ))}
        <div className="sm:col-span-2"><Button type="submit" variant="outline">Check values</Button></div>
      </form>
      {checked && (
        <dl className="grid gap-2 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.id}><dt className="text-xs text-muted-foreground">{f.name}</dt><dd><CustomFieldValue def={f} value={checked[f.key]} members={members} /></dd></div>
          ))}
        </dl>
      )}
    </section>
  );
}

function FieldDialog({ entity, field, onClose }: { entity: CustomFieldEntity; field: Field | "new" | null; onClose: () => void }) {
  return (
    <Dialog open={!!field} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {field && <FieldForm key={field === "new" ? "new" : field.id} entity={entity} field={field === "new" ? null : field} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function FieldForm({ entity, field, onDone }: { entity: CustomFieldEntity; field: Field | null; onDone: () => void }) {
  const [name, setName] = useState(field?.name ?? "");
  const [key, setKey] = useState(field?.key ?? "");
  const [keyTouched, setKeyTouched] = useState(!!field);
  const [type, setType] = useState<CustomFieldType>(field?.type ?? "text");
  const [options, setOptions] = useState((field?.options ?? []).join("\n"));
  const [required, setRequired] = useState(field?.required ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useConfigMutation(createCustomField, "Field added");
  const update = useConfigMutation(updateCustomField, "Field saved");
  const pending = create.isPending || update.isPending;
  const opts = options.split("\n").map((o) => o.trim()).filter(Boolean);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = { entity_type: entity, name, key, type, options: TYPES_WITH_OPTIONS.includes(type) ? opts : [], required };
    const r = customFieldCreate.safeParse(input);
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    if (field) update.mutate({ id: field.id, name: r.data.name, options: r.data.options, required }, { onSuccess: onDone });
    else create.mutate(r.data, { onSuccess: onDone });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{field ? "Edit field" : "Add field"}</DialogTitle>
        <DialogDescription>{field ? "The key and type can’t change once created." : "Choose a name and a type."}</DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="f-name">Name</Label>
        <Input id="f-name" value={name} aria-invalid={!!errors["name"]}
          onChange={(e) => { setName(e.target.value); if (!keyTouched) setKey(suggestFieldKey(e.target.value)); }} />
        {errors["name"] && <p className="text-xs text-destructive">{errors["name"]}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="f-key">Key</Label>
          <Input id="f-key" className="font-mono" value={key} disabled={!!field} aria-invalid={!!errors["key"]}
            onChange={(e) => { setKey(e.target.value); setKeyTouched(true); }} />
          {errors["key"] && <p className="text-xs text-destructive">{errors["key"]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-type">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as CustomFieldType)} disabled={!!field}>
            <SelectTrigger id="f-type"><SelectValue /></SelectTrigger>
            <SelectContent>{CUSTOM_FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {TYPES_WITH_OPTIONS.includes(type) && (
        <div className="space-y-1.5">
          <Label htmlFor="f-opts">Options (one per line)</Label>
          <Textarea id="f-opts" rows={4} value={options} onChange={(e) => setOptions(e.target.value)} aria-invalid={!!errors["options"]} />
          {errors["options"] && <p className="text-xs text-destructive">{errors["options"]}</p>}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Switch id="f-req" checked={required} onCheckedChange={setRequired} />
        <Label htmlFor="f-req">Required</Label>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} {field ? "Save" : "Add field"}</Button>
      </DialogFooter>
    </form>
  );
}
