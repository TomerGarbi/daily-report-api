import { z } from "zod";
import { ROLE_HIERARCHY } from "../types/auth";

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Must be a valid ObjectId");

// Sort fields — allow-listed so callers can't inject arbitrary Mongo fields.
export const USER_SORT_FIELDS = [
  "username",
  "lastLoginAt",
  "lastActivityAt",
  "createdAt",
] as const;

export const USER_STATUS_VALUES = [
  "active",
  "dormant",
  "disabled",
  "neverLoggedIn",
] as const;

// ─── List query ───────────────────────────────────────────────────────────────

export const listUsersSchema = z.object({
  role:    z.enum(ROLE_HIERARCHY).optional(),
  group:   objectId.optional(),
  search:  z.string().max(100).optional(),        // partial username match
  status:  z.enum(USER_STATUS_VALUES).optional(),
  sort:    z.enum(USER_SORT_FIELDS).optional(),
  order:   z.enum(["asc", "desc"]).optional(),
  page:    z.coerce.number().int().min(1).optional().default(1),
  limit:   z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateUserSchema = z.object({
  role:     z.enum(ROLE_HIERARCHY).optional(),
  groups:   z.array(objectId).optional(),
  disabled: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" }
);

// ─── Inferred types ───────────────────────────────────────────────────────────

export type ListUsersQuery  = z.infer<typeof listUsersSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
