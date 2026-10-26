import { createFileRoute } from "@tanstack/react-router";
import { Flag } from "lucide-react";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";
import { guardSection } from "@/lib/auth/guard";

export const Route = createFileRoute("/_authenticated/milestones")({
  beforeLoad: guardSection("milestones"),
  head: () => ({ meta: [{ title: "Milestones — PlanAProject" }, { name: "description", content: "Key dates and how close you are." }] }),
  component: Page,
});

function Page() {
  return <SectionPlaceholder title="Milestones" description="Key dates and how close you are." icon={Flag} />;
}
