import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import type { ZodTypeAny } from "zod";
import { createProject } from "@/functions/project.functions";
import {
  PROJECT_HEALTH,
  PROJECT_STATUSES,
  projectBasicsSchema,
  projectGoalsSchema,
  projectProfileSchema,
  projectTimelineSchema,
} from "@/lib/schemas/project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/brand/logo";
import { HealthBadge } from "@/components/common/health-badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/setup")({
  beforeLoad: ({ context }) => {
    if (context.me.membership) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Set up your project — PlanAProject" },
      { name: "description", content: "Create your project profile in a few quick steps." },
    ],
  }),
  component: SetupWizard,
});

type Form = {
  name: string;
  code: string;
  description: string;
  objectives: string;
  sponsor: string;
  start_date: string;
  target_end_date: string;
  status: "planning" | "active" | "on_hold" | "completed";
  health: "green" | "amber" | "red";
};
type Errors = Partial<Record<keyof Form, string>>;

const STEPS: { title: string; blurb: string; schema: ZodTypeAny | null }[] = [
  { title: "Basics", blurb: "What is this project called?", schema: projectBasicsSchema },
  { title: "Goals", blurb: "Why does it exist, and who backs it?", schema: projectGoalsSchema },
  { title: "Timeline", blurb: "When does it run, and how is it going?", schema: projectTimelineSchema },
  { title: "Review", blurb: "Check everything before you create it.", schema: null },
];

function suggestCode(name: string) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  const raw = words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "");
  return raw.replace(/^[0-9]+/, "").slice(0, 6);
}

function toErrors(issues: { path: (string | number)[]; message: string }[]): Errors {
  const e: Errors = {};
  for (const i of issues) {
    const k = i.path[0] as keyof Form;
    if (k && !e[k]) e[k] = i.message;
  }
  return e;
}

function SetupWizard() {
  const navigate = useNavigate();
  const router = useRouter();
  const create = useServerFn(createProject);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [codeTouched, setCodeTouched] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [form, setForm] = useState<Form>({
    name: "",
    code: "",
    description: "",
    objectives: "",
    sponsor: "",
    start_date: new Date().toISOString().slice(0, 10),
    target_end_date: "",
    status: "planning",
    health: "green",
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "name" && !codeTouched) next.code = suggestCode(String(v));
      return next;
    });
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  function validateStep(i: number) {
    const schema = i === 2 || i === 3 ? projectProfileSchema : STEPS[i]?.schema;
    if (!schema) return true;
    const r = schema.safeParse(form);
    if (r.success) return true;
    const e = toErrors(r.error.issues);
    // Only show errors for the current step's fields (except on review).
    const stepFields: Record<number, (keyof Form)[]> = {
      0: ["name", "code", "description"],
      1: ["objectives", "sponsor"],
      2: ["start_date", "target_end_date", "status", "health"],
    };
    const relevant = i === 3 ? e : Object.fromEntries(Object.entries(e).filter(([k]) => stepFields[i]?.includes(k as keyof Form)));
    if (Object.keys(relevant).length === 0) return true;
    setErrors(relevant);
    if (i === 3) {
      const firstStep = [0, 1, 2].find((s) => stepFields[s]?.some((f) => relevant[f]));
      if (firstStep !== undefined) setStep(firstStep);
    }
    return false;
  }

  function next() {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    if (!validateStep(3)) return;
    setBusy(true);
    try {
      const project = await create({ data: form });
      toast.success(`${project.name} is ready`);
      await router.invalidate({ sync: true });
      navigate({ to: "/dashboard", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the project");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-auth">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Logo />
        <span className="text-sm text-muted-foreground">First-run setup</span>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-20">
        <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Setup progress">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                aria-current={i === step ? "step" : undefined}
                className="group w-full text-left focus-visible:outline-none"
              >
                <span className={cn("block h-1 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-border")} />
                <span className={cn("mt-2 flex items-center gap-1.5 text-xs font-medium sm:text-sm", i === step ? "text-foreground" : "text-muted-foreground", "group-focus-visible:underline")}>
                  {i < step && <Check className="size-3.5 text-primary" aria-hidden />}
                  {s.title}
                </span>
              </button>
            </li>
          ))}
        </ol>

        <form
          className="rounded-2xl border bg-card p-6 shadow-card sm:p-8"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 3) submit();
            else next();
          }}
        >
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">Step {step + 1} of 4</p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{STEPS[step]?.blurb}</h1>

          <div className="mt-8 space-y-5">
            {step === 0 && (
              <>
                <Field label="Project name" htmlFor="name" error={errors.name}>
                  <Input id="name" autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Website relaunch" maxLength={120} />
                </Field>
                <Field label="Project code" htmlFor="code" error={errors.code} hint="Short prefix used for item numbers, e.g. WEB-12.">
                  <Input
                    id="code"
                    value={form.code}
                    onChange={(e) => { setCodeTouched(true); set("code", e.target.value.toUpperCase()); }}
                    className="max-w-48 font-mono uppercase"
                    maxLength={10}
                  />
                </Field>
                <Field label="Description" htmlFor="description" error={errors.description} optional>
                  <Textarea id="description" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="A sentence or two about what this project delivers." />
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                <Field label="Objectives" htmlFor="objectives" error={errors.objectives} optional hint="One per line works well.">
                  <Textarea id="objectives" autoFocus rows={5} value={form.objectives} onChange={(e) => set("objectives", e.target.value)} placeholder={"Launch the new site by Q3\nCut page load time in half"} />
                </Field>
                <Field label="Sponsor" htmlFor="sponsor" error={errors.sponsor} optional>
                  <Input id="sponsor" value={form.sponsor} onChange={(e) => set("sponsor", e.target.value)} placeholder="Who is accountable for this project?" />
                </Field>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Start date" htmlFor="start_date" error={errors.start_date} optional>
                    <Input id="start_date" type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
                  </Field>
                  <Field label="Target end date" htmlFor="target_end_date" error={errors.target_end_date} optional>
                    <Input id="target_end_date" type="date" min={form.start_date || undefined} value={form.target_end_date} onChange={(e) => set("target_end_date", e.target.value)} />
                  </Field>
                </div>
                <Field label="Status" htmlFor="status" error={errors.status}>
                  <Select value={form.status} onValueChange={(v) => set("status", v as Form["status"])}>
                    <SelectTrigger id="status" className="max-w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <fieldset>
                  <legend className="text-sm font-medium">Health</legend>
                  <div role="radiogroup" className="mt-2 grid gap-2 sm:grid-cols-3">
                    {PROJECT_HEALTH.map((h) => (
                      <button
                        key={h.value}
                        type="button"
                        role="radio"
                        aria-checked={form.health === h.value}
                        onClick={() => set("health", h.value)}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          form.health === h.value ? "border-primary bg-secondary" : "hover:bg-muted",
                        )}
                      >
                        <HealthBadge value={h.value} />
                        <span className="mt-1.5 block text-xs text-muted-foreground">{h.hint}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            {step === 3 && <Review form={form} />}
          </div>

          <div className="mt-10 flex items-center justify-between gap-3 border-t pt-6">
            <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>
              Back
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {step === 3 ? "Create project" : "Continue"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({ label, htmlFor, error, hint, optional, children }: { label: string; htmlFor: string; error?: string; hint?: string; optional?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label} {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function Review({ form }: { form: Form }) {
  const status = PROJECT_STATUSES.find((s) => s.value === form.status)?.label;
  const rows: [string, ReactNode][] = [
    ["Name", form.name],
    ["Code", <span className="font-mono">{form.code}</span>],
    ["Description", form.description || "—"],
    ["Objectives", form.objectives ? <span className="whitespace-pre-line">{form.objectives}</span> : "—"],
    ["Sponsor", form.sponsor || "—"],
    ["Dates", `${form.start_date || "No start"} → ${form.target_end_date || "No target end"}`],
    ["Status", status],
    ["Health", <HealthBadge value={form.health} />],
  ];
  return (
    <dl className="divide-y rounded-lg border">
      {rows.map(([k, v]) => (
        <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr]">
          <dt className="text-sm text-muted-foreground">{k}</dt>
          <dd className="text-sm">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
