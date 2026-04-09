import { z } from "zod";
import { ROLE_HIERARCHY } from "../types/auth";

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Must be a valid ObjectId");

// ─── List query ───────────────────────────────────────────────────────────────

export const listUsersSchema = z.object({
  role:    z.enum(ROLE_HIERARCHY).optional(),
  group:   objectId.optional(),
  search:  z.string().max(100).optional(),        // partial username match
  page:    z.coerce.number().int().min(1).optional().default(1),
  limit:   z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateUserSchema = z.object({
  role:   z.enum(ROLE_HIERARCHY).optional(),
  groups: z.array(objectId).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" }
);

// ─── Inferred types ───────────────────────────────────────────────────────────

export type ListUsersQuery  = z.infer<typeof listUsersSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
