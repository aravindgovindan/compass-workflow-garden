import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";
import { guardSection } from "@/lib/auth/guard";

export const Route = createFileRoute("/_authenticated/_app/risks")({
  beforeLoad: guardSection("risks"),
  head: () => ({ meta: [{ title: "Risks — PlanAProject" }, { name: "description", content: "What could go wrong, and the plan for it." }] }),
  component: Page,
});

function Page() {
  return <SectionPlaceholder term="risk" description="What could go wrong, and the plan for it." icon={ShieldAlert} />;
}
