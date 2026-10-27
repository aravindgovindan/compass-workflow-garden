import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, ArrowLeft, Printer, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { guideRoles, sectionsForRole } from "@/lib/guide/content";

const searchSchema = z.object({ role: z.enum(["owner", "member", "stakeholder"]).catch("owner").default("owner") });

export const Route = createFileRoute("/guide")({
  validateSearch: searchSchema,
  head: () => ({ meta: [
    { title: "User guide — Compass Workflow" },
    { name: "description", content: "Step-by-step guides for Compass Workflow owners, members and stakeholders: setup, work, reviews, collaboration and exports." },
    { property: "og:title", content: "User guide — Compass Workflow" },
    { property: "og:description", content: "Learn how to configure, run and review your projects with detailed guides for each role." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: UserGuide,
});

function UserGuide() {
  const { role } = Route.useSearch();
  const navigate = Route.useNavigate();
  const sections = sectionsForRole(role);
  const selected = guideRoles.find((item) => item.value === role);
  return (
    <div className="min-h-screen bg-background tracking-normal">
      <header className="border-b print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/" aria-label="Compass Workflow home"><Logo /></Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft aria-hidden />Home</Link></Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer aria-hidden />Print guide</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="border-b pb-8">
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-primary"><BookOpen className="size-4" aria-hidden />Compass Workflow handbook</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal">User guide</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">A practical reference for setting up, running and reviewing your projects.</p>
          <Tabs value={role} onValueChange={(value) => { const result = searchSchema.safeParse({ role: value }); if (result.success) navigate({ search: result.data, replace: true, resetScroll: false }); }} className="mt-6 print:hidden">
            <TabsList className="grid h-11 w-full max-w-md grid-cols-3">
              {guideRoles.map((item) => <TabsTrigger key={item.value} value={item.value} className="h-full">{item.title}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <h2 className="mt-5 text-xl font-semibold tracking-normal">{selected?.title} guide</h2>
          <p className="mt-1 text-sm text-muted-foreground">{selected?.summary}</p>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden />Reading this guide does not change your account or project role.</p>
        </div>
        <div className="grid gap-8 pt-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
          <aside className="print:hidden">
            <nav aria-label="Guide contents" className="lg:sticky lg:top-6">
              <h2 className="text-sm font-semibold tracking-normal">In this guide</h2>
              <ol className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
                {sections.map((section, index) => <li key={section.id}><Button asChild variant="ghost" className="h-auto min-h-9 w-full justify-start gap-3 whitespace-normal px-2 py-2 text-left text-sm"><a href={`#${section.id}`}><span className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span><span>{section.title}</span></a></Button></li>)}
              </ol>
            </nav>
          </aside>
          <article key={role} aria-label={`${selected?.title} user guide`} className="min-w-0 space-y-10">
            {sections.map((section, index) => (
              <section key={section.id} id={section.id} className="scroll-mt-6 border-b pb-8 last:border-b-0 print:break-inside-avoid-page">
                <p className="font-mono text-xs text-primary">{String(index + 1).padStart(2, "0")}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-normal">{section.title}</h2>
                <p className="mt-3 leading-relaxed text-muted-foreground">{section.intro}</p>
                <ol className="mt-5 list-decimal space-y-4 pl-5 text-sm leading-7 marker:font-semibold marker:text-primary">
                  {section.steps.map((step) => <li key={step} className="pl-2">{step}</li>)}
                </ol>
                {section.note && <p className="mt-5 border-l-2 border-primary bg-secondary/50 px-4 py-3 text-sm leading-6"><strong>Keep in mind: </strong>{section.note}</p>}
              </section>
            ))}
            <footer className="text-xs text-muted-foreground">Compass Workflow · Role-based user guide · October 2026</footer>
          </article>
        </div>
      </main>
    </div>
  );
}