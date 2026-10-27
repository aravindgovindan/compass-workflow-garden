import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle, Plus } from "lucide-react";
import { createProject } from "@/functions/project.functions";
import { PROJECT_HEALTH, PROJECT_STATUSES, projectProfileSchema, type ProjectProfileInput } from "@/lib/schemas/project";
import { useProjectMutation } from "@/lib/projects/use-project-mutation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CreateProjectDialog({ open, onOpenChange, onBusy }: { open: boolean; onOpenChange: (open: boolean) => void; onBusy: (busy: boolean) => void }) {
  const [form, setForm] = useState<ProjectProfileInput>({ name: "", code: "", description: "", status: "planning", health: "green" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useServerFn(createProject);
  const mutation = useProjectMutation((input: ProjectProfileInput) => create({ data: input }), onBusy, () => onOpenChange(false));
  const set = (key: keyof ProjectProfileInput, value: string) => { setForm((prev) => ({ ...prev, [key]: value })); setErrors((prev) => ({ ...prev, [key]: "" })); };
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!mutation.isPending) onOpenChange(value); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
        <DialogHeader><DialogTitle>New project</DialogTitle><DialogDescription className="sr-only">Create a project</DialogDescription></DialogHeader>
        <form className="space-y-4" noValidate onSubmit={(event) => {
          event.preventDefault();
          const result = projectProfileSchema.safeParse(form);
          if (!result.success) { setErrors(Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); return; }
          mutation.mutate(form);
        }}>
          <div className="space-y-1.5"><Label htmlFor="new-project-name">Project name</Label><Input id="new-project-name" autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={120} aria-invalid={!!errors.name} />{errors.name && <p role="alert" className="text-xs text-destructive">{errors.name}</p>}</div>
          <div className="space-y-1.5"><Label htmlFor="new-project-code">Project code</Label><Input id="new-project-code" className="font-mono" value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} maxLength={10} aria-invalid={!!errors.code} />{errors.code && <p role="alert" className="text-xs text-destructive">{errors.code}</p>}</div>
          <div className="space-y-1.5"><Label htmlFor="new-project-description">Description (optional)</Label><Textarea id="new-project-description" value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={3} maxLength={2000} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label htmlFor="new-project-status">Status</Label><Select value={form.status} onValueChange={(value) => set("status", value)}><SelectTrigger id="new-project-status"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label htmlFor="new-project-health">Health</Label><Select value={form.health} onValueChange={(value) => set("health", value)}><SelectTrigger id="new-project-health"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_HEALTH.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter className="gap-2 pt-2"><Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? <LoaderCircle className="animate-spin" /> : <Plus />}Create project</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}