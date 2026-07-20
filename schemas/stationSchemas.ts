import { z } from "zod";
import { STATION_TYPES, STATION_FUELS } from "../models/Station";

// ─── Common ───────────────────────────────────────────────────────────────────

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Must be a valid ObjectId");

const fuelCapacitySchema = z.object({
  type:     z.enum(STATION_FUELS),
  capacity: z.number().min(0, "Capacity must be ≥ 0"),
});

// ─── Unit ─────────────────────────────────────────────────────────────────────

export const unitSchema = z.object({
  number:         z.number().int().min(1, "Unit number must be ≥ 1"),
  mainFuel:       fuelCapacitySchema,
  secondaryFuels: z.array(fuelCapacitySchema).max(10).optional().default([]),
});

export const updateUnitSchema = unitSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" }
);

// ─── Station ──────────────────────────────────────────────────────────────────

export const createStationSchema = z.object({
  name:    z.string().trim().min(1, "Name is required").max(200),
  tag:     z.string().trim().min(1, "Tag is required").max(50),
  type:    z.enum(STATION_TYPES),
  groupId: objectId.nullable().optional(),
  units:   z.array(unitSchema).max(50).optional().default([]),
});

export const updateStationSchema = z.object({
  name:    z.string().trim().min(1).max(200).optional(),
  tag:     z.string().trim().min(1).max(50).optional(),
  type:    z.enum(STATION_TYPES).optional(),
  groupId: objectId.nullable().optional(),
  units:   z.array(unitSchema).max(50).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" }
);

// ─── List query ───────────────────────────────────────────────────────────────

export const listStationsSchema = z.object({
  type:    z.enum(STATION_TYPES).optional(),
  /** Filter to stations that have at least one unit whose main fuel matches. */
  fuel:    z.enum(STATION_FUELS).optional(),
  groupId: objectId.optional(),
  search:  z.string().max(200).optional(),
  page:    z.coerce.number().int().min(1).optional().default(1),
  limit:   z.coerce.number().int().min(1).max(200).optional().default(50),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type UnitInput            = z.infer<typeof unitSchema>;
export type UpdateUnitInput      = z.infer<typeof updateUnitSchema>;
export type CreateStationInput   = z.infer<typeof createStationSchema>;
export type UpdateStationInput   = z.infer<typeof updateStationSchema>;
export type ListStationsQuery    = z.infer<typeof listStationsSchema>;
