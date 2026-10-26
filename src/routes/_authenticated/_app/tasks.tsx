import { createFileRoute } from "@tanstack/react-router";
import { ListTodo } from "lucide-react";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";
import { guardSection } from "@/lib/auth/guard";

export const Route = createFileRoute("/_authenticated/_app/tasks")({
  beforeLoad: guardSection("tasks"),
  head: () => ({ meta: [{ title: "Tasks — PlanAProject" }, { name: "description", content: "Plan and track the work." }] }),
  component: Page,
});

function Page() {
  return <SectionPlaceholder term="task" description="Plan and track the work." icon={ListTodo} />;
}
