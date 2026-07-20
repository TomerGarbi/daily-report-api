import { z } from "zod";
import { STATION_TYPES } from "../models/Station";

// ─── Common ───────────────────────────────────────────────────────────────────

const tagSchema = z
  .string()
  .trim()
  .min(1, "Tag is required")
  .max(60)
  .regex(
    /^[a-z0-9][a-z0-9-]*$/,
    "Tag must be lowercase letters, digits, and hyphens (starting with a letter/digit)",
  );

// ─── Create / update ──────────────────────────────────────────────────────────

export const createStationGroupSchema = z.object({
  name:        z.string().trim().min(1, "Name is required").max(200),
  tag:         tagSchema,
  type:        z.enum(STATION_TYPES),
  order:       z.number().int().min(0).optional().default(0),
  description: z.string().trim().max(500).optional(),
});

export const updateStationGroupSchema = z
  .object({
    name:        z.string().trim().min(1).max(200).optional(),
    tag:         tagSchema.optional(),
    type:        z.enum(STATION_TYPES).optional(),
    order:       z.number().int().min(0).optional(),
    description: z.string().trim().max(500).optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided for update" },
  );

// ─── List query ───────────────────────────────────────────────────────────────

export const listStationGroupsSchema = z.object({
  type:   z.enum(STATION_TYPES).optional(),
  search: z.string().max(200).optional(),
  page:   z.coerce.number().int().min(1).optional().default(1),
  limit:  z.coerce.number().int().min(1).max(500).optional().default(200),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CreateStationGroupInput = z.infer<typeof createStationGroupSchema>;
export type UpdateStationGroupInput = z.infer<typeof updateStationGroupSchema>;
export type ListStationGroupsQuery  = z.infer<typeof listStationGroupsSchema>;
