import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Compass Workflow — run one project, simply" },
      {
        name: "description",
        content: "Set up your workflow, tasks, milestones, risks and issues in minutes. Built for teams of 2 to 30.",
      },
      { property: "og:title", content: "Compass Workflow — run one project, simply" },
      {
        property: "og:description",
        content: "Set up your workflow, tasks, milestones, risks and issues in minutes. Built for teams of 2 to 30.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const points = [
  "Your words, your workflow — rename anything, set your own statuses",
  "Tasks, milestones, risks and issues in one place",
  "Owners configure, members work, stakeholders follow along",
];

function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <div className="min-h-screen bg-auth">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <Button asChild variant="outline">
          <Link to={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Open dashboard" : "Sign in"}</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pt-28">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">One project. One place.</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] sm:text-6xl">
          Project management without the Jira-sized learning curve.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Configure Compass Workflow in minutes, then run your project with a team of 2 to 30 people.
        </p>
        <ul className="mt-8 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {p}
            </li>
          ))}
        </ul>
        <div className="mt-10 flex gap-3">
          <Button asChild size="lg">
            <Link to={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Open dashboard" : "Get started"}</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
