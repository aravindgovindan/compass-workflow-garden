import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { z } from "zod";
import {
  createMilestone, deleteMilestone, linkTasksToMilestone, listMilestones, listMilestoneTasks, unlinkTaskFromMilestone, updateMilestone,
} from "@/functions/milestones.functions";
import type { milestoneCreate, milestoneUpdate } from "@/lib/schemas/milestones";
import { friendlyError } from "@/lib/errors";

export const milestonesQuery = queryOptions({ queryKey: ["milestones"], queryFn: () => listMilestones() });
export const milestoneTasksQuery = (id: string) =>
  queryOptions({ queryKey: ["milestones", "tasks", id], queryFn: () => listMilestoneTasks({ data: { id } }) });

const errMsg = friendlyError;

function useMsMutation<I>(fn: (i: I) => Promise<unknown>, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { if (success) toast.success(success); },
    onError: (e) => toast.error(errMsg(e)),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ["milestones"] }), qc.invalidateQueries({ queryKey: ["tasks"] })]),
  });
}

export const useCreateMilestone = () => useMsMutation((d: z.input<typeof milestoneCreate>) => createMilestone({ data: d }), "Added");
export const useUpdateMilestone = () => useMsMutation((d: z.input<typeof milestoneUpdate>) => updateMilestone({ data: d }), "Saved");
export const useDeleteMilestone = () => useMsMutation((id: string) => deleteMilestone({ data: { id } }), "Deleted");
export const useLinkTasks = () => useMsMutation((d: { milestoneId: string; taskIds: string[] }) => linkTasksToMilestone({ data: d }));
export const useUnlinkTask = () => useMsMutation((taskId: string) => unlinkTaskFromMilestone({ data: { taskId } }));
