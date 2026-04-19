import { z } from "zod";

// ─── List query ───────────────────────────────────────────────────────────────

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/, "Must be an ISO 8601 date (YYYY-MM-DD or full ISO)");

export const listLogsSchema = z.object({
  level:   z.enum(["info", "warn", "error", "debug"]).optional(),
  user:    z.string().max(100).optional(),
  context: z.string().max(200).optional(),
  search:  z.string().max(200).optional(),           // message substring
  from:    isoDate.optional(),                        // logs on or after this timestamp
  to:      isoDate.optional(),                        // logs on or before this timestamp
  page:    z.coerce.number().int().min(1).optional().default(1),
  limit:   z.coerce.number().int().min(1).max(100).optional().default(50),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type ListLogsQuery = z.infer<typeof listLogsSchema>;
