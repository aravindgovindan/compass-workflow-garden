import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, PageHeader } from "@/components/common/empty-state";
import { WorkflowTab } from "@/components/settings/workflow-tab";
import { TerminologyTab } from "@/components/settings/terminology-tab";
import { ListsTab } from "@/components/settings/lists-tab";
import { CustomFieldsTab } from "@/components/settings/custom-fields-tab";
import { guardSection } from "@/lib/auth/guard";
import { useProjectConfig } from "@/lib/config/use-config";

export const Route = createFileRoute("/_authenticated/_app/settings")({
  beforeLoad: guardSection("settings"),
  head: () => ({
    meta: [
      { title: "Settings — PlanAProject" },
      { name: "description", content: "Workflow, terminology, priorities, labels and custom fields." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data, isPending, error, refetch } = useProjectConfig();
  return (
    <>
      <PageHeader title="Settings" description="Workflow, terminology, priorities, labels and custom fields." />
      {isPending ? (
        <div className="space-y-3"><Skeleton className="h-10 w-full max-w-md" /><Skeleton className="h-64 w-full" /></div>
      ) : error || !data ? (
        <ErrorState message={error?.message ?? "Could not load settings."} onRetry={() => refetch()} />
      ) : (
        <Tabs defaultValue="workflow" className="space-y-6">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
            <TabsTrigger value="terminology">Terminology</TabsTrigger>
            <TabsTrigger value="lists">Priorities &amp; labels</TabsTrigger>
            <TabsTrigger value="fields">Custom fields</TabsTrigger>
          </TabsList>
          <TabsContent value="workflow"><WorkflowTab statuses={data.statuses} /></TabsContent>
          <TabsContent value="terminology"><TerminologyTab terms={data.terms} /></TabsContent>
          <TabsContent value="lists"><ListsTab priorities={data.priorities} labels={data.labels} /></TabsContent>
          <TabsContent value="fields"><CustomFieldsTab fields={data.customFields} members={data.members} /></TabsContent>
        </Tabs>
      )}
    </>
  );
}
