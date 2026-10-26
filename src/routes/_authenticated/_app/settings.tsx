import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";
import { guardSection } from "@/lib/auth/guard";

export const Route = createFileRoute("/_authenticated/_app/settings")({
  beforeLoad: guardSection("settings"),
  head: () => ({ meta: [{ title: "Settings — PlanAProject" }, { name: "description", content: "Project, workflow, terminology and fields." }] }),
  component: Page,
});

function Page() {
  return <SectionPlaceholder title="Settings" description="Project, workflow, terminology and fields." icon={Settings} />;
}
