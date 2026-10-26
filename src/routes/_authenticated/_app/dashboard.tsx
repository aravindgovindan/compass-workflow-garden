import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export const Route = createFileRoute("/_authenticated/_app/dashboard")({

  head: () => ({ meta: [{ title: "Dashboard — Compass Workflow" }, { name: "description", content: "Project health, progress and what needs attention." }, { property: "og:title", content: "Dashboard — Compass Workflow" }, { property: "og:description", content: "Project health, progress and what needs attention." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

function Page() {
  return <SectionPlaceholder term="dashboard" description="Project health, progress and what needs attention." icon={LayoutDashboard} />;
}
