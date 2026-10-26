import { z } from "zod";
import { MILESTONE_STATUSES } from "@/lib/milestones/status";

const id = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");

export const milestoneCreate = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "120 characters max"),
  description: z.string().max(5000, "5,000 characters max").nullable().optional(),
  target_date: day,
  owner_id: id.nullable().optional(),
  status_override: z.enum(MILESTONE_STATUSES).nullable().optional(),
});

export const milestoneUpdate = milestoneCreate.partial().extend({ id });

export const milestoneLink = z.object({ milestoneId: id, taskIds: z.array(id).min(1).max(500) });
export const milestoneUnlink = z.object({ taskId: id });
