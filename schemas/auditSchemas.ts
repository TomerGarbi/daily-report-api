import { z } from "zod";

// ─── List query ───────────────────────────────────────────────────────────────

export const listAuditSchema = z.object({
  actor:        z.string().max(100).optional(),
  action:       z.string().max(100).optional(),
  resourceType: z.string().max(50).optional(),
  resourceId:   z.string().max(100).optional(),
  outcome:      z.enum(["success", "failure"]).optional(),
  from:         z.string().datetime().optional(),
  to:           z.string().datetime().optional(),
  requestId:    z.string().max(100).optional(),
  page:         z.coerce.number().int().min(1).optional().default(1),
  limit:        z.coerce.number().int().min(1).max(200).optional().default(50),
});

export type ListAuditQuery = z.infer<typeof listAuditSchema>;
