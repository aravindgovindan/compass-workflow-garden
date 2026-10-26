import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export const Route = createFileRoute("/_authenticated/_app/dashboard")({

  head: () => ({ meta: [{ title: "Dashboard — PlanAProject" }, { name: "description", content: "Project health, progress and what needs attention." }] }),
  component: Page,
});

function Page() {
  return <SectionPlaceholder title="Dashboard" description="Project health, progress and what needs attention." icon={LayoutDashboard} />;
}
