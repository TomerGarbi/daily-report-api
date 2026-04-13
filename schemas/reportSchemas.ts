import { z } from "zod";

// ─── Create ───────────────────────────────────────────────────────────────────

export const createReportSchema = z.object({
  title:       z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required").max(500),
  content:     z.record(z.string(), z.unknown()).optional().default({}),
  status:      z.enum(["draft", "published"]).optional().default("published"),
});

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateReportSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(500).optional(),
  content:     z.record(z.string(), z.unknown()).optional(),
  status:      z.enum(["draft", "published"]).optional().default("published"),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" }
);

// ─── List query ───────────────────────────────────────────────────────────────

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/, "Must be an ISO 8601 date (YYYY-MM-DD or full ISO)");

export const listReportsSchema = z.object({
  status:        z.enum(["draft", "published"]).optional(),
  search:        z.string().max(200).optional(),         // title substring
  author:        z.string().max(100).optional(),         // createdBy.username substring
  createdAfter:  isoDate.optional(),                     // reports created on or after this date
  createdBefore: isoDate.optional(),                     // reports created on or before this date
  page:          z.coerce.number().int().min(1).optional().default(1),
  limit:         z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type ListReportsQuery  = z.infer<typeof listReportsSchema>;
