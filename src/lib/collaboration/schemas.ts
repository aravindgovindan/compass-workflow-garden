import { z } from "zod";
export const entity = z.enum(["task", "risk", "issue"]);
export const role = z.enum(["owner", "member", "stakeholder"]);
export const recordInput = z.object({
  entityType: entity,
  entityId: z.string().uuid(),
  page: z.number().int().min(0).default(0),
});
export const commentCreate = recordInput
  .omit({ page: true })
  .extend({ body: z.string().trim().min(1).max(10000) });
export const commentUpdate = z.object({
  id: z.string().uuid(),
  body: z.string().trim().min(1).max(10000),
});
export const idInput = z.object({ id: z.string().uuid() });
export const invitationInput = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  role,
});
export const memberInput = z.object({
  userId: z.string().uuid(),
  role,
  deactivate: z.boolean().default(false),
  reassignTo: z.string().uuid().nullable().default(null),
});
export const activityInput = z
  .object({
    page: z.number().int().min(0).default(0),
    actorId: z.string().uuid().optional(),
    entityType: z.string().max(60).optional(),
    entityId: z.string().uuid().optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  })
  .refine((x) => !x.from || !x.to || x.from <= x.to, "End date must not precede start date");
