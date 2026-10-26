import { keepPreviousData, queryOptions, useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { z } from "zod";
import { convertRiskToIssue, createRisk, deleteRisk, getRisk, listRisks, updateRisk } from "@/functions/risks.functions";
import { createIssue, deleteIssue, getIssue, listIssues, updateIssue } from "@/functions/issues.functions";
import type { issueUpdate, IssueFilters, riskUpdate, RiskFilters } from "@/lib/schemas/registers";
import type { IssueSeverity } from "@/lib/risks/score";

export const risksQuery = (f: RiskFilters) =>
  queryOptions({ queryKey: ["risks", "list", f], queryFn: () => listRisks({ data: f }), placeholderData: keepPreviousData });
export const riskQuery = (id: string) => queryOptions({ queryKey: ["risks", "detail", id], queryFn: () => getRisk({ data: { id } }) });
export const issuesQuery = (f: IssueFilters) =>
  queryOptions({ queryKey: ["issues", "list", f], queryFn: () => listIssues({ data: f }), placeholderData: keepPreviousData });
export const issueQuery = (id: string) => queryOptions({ queryKey: ["issues", "detail", id], queryFn: () => getIssue({ data: { id } }) });

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

function useRegMutation<I, O>(key: string[], fn: (i: I) => Promise<O>, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: key,
    mutationFn: fn,
    onSuccess: () => { if (success) toast.success(success); },
    onError: (e) => toast.error(errMsg(e)),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ["risks"] }), qc.invalidateQueries({ queryKey: ["issues"] })]),
  });
}

export const useRegisterSaving = (kind: "risk" | "issue", id: string) => useIsMutating({ mutationKey: [`${kind}-save`, id] }) > 0;

export const useCreateRisk = () => useRegMutation(["risk-create"], (title: string) => createRisk({ data: { title } }), "Added");
export const useUpdateRisk = (id: string) =>
  useRegMutation(["risk-save", id], (d: Omit<z.input<typeof riskUpdate>, "id">) => updateRisk({ data: { ...d, id } }));
export const useDeleteRisk = () => useRegMutation(["risk-delete"], (id: string) => deleteRisk({ data: { id } }), "Deleted");
export const useConvertRisk = () =>
  useRegMutation(["risk-convert"], (d: { id: string; severity: IssueSeverity }) => convertRiskToIssue({ data: d }), "Converted");

export const useCreateIssue = () => useRegMutation(["issue-create"], (title: string) => createIssue({ data: { title } }), "Added");
export const useUpdateIssue = (id: string) =>
  useRegMutation(["issue-save", id], (d: Omit<z.input<typeof issueUpdate>, "id">) => updateIssue({ data: { ...d, id } }));
export const useDeleteIssue = () => useRegMutation(["issue-delete"], (id: string) => deleteIssue({ data: { id } }), "Deleted");
