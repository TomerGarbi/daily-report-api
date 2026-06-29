import { z } from "zod";
import { STATION_FUELS } from "../models/Station";

// ─── Tank ─────────────────────────────────────────────────────────────────────

export const tankSchema = z.object({
  name:     z.string().trim().min(1, "Tank name is required").max(100),
  fuelType: z.enum(STATION_FUELS),
  capacity: z.number().min(0).optional(),
});

export const updateTankSchema = tankSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" }
);

// ─── Fuel site ────────────────────────────────────────────────────────────────

export const createFuelSiteSchema = z.object({
  name:      z.string().trim().min(1, "Name is required").max(200),
  tag:       z.string().trim().min(1, "Tag is required").max(50),
  fuelTypes: z.array(z.enum(STATION_FUELS)).max(20).optional().default([]),
  tanks:     z.array(tankSchema).max(200).optional().default([]),
});

export const updateFuelSiteSchema = z.object({
  name:      z.string().trim().min(1).max(200).optional(),
  tag:       z.string().trim().min(1).max(50).optional(),
  fuelTypes: z.array(z.enum(STATION_FUELS)).max(20).optional(),
  tanks:     z.array(tankSchema).max(200).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" }
);

// ─── List query ───────────────────────────────────────────────────────────────

export const listFuelSitesSchema = z.object({
  fuel:   z.enum(STATION_FUELS).optional(),
  search: z.string().max(200).optional(),
  page:   z.coerce.number().int().min(1).optional().default(1),
  limit:  z.coerce.number().int().min(1).max(200).optional().default(50),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type TankInput            = z.infer<typeof tankSchema>;
export type UpdateTankInput      = z.infer<typeof updateTankSchema>;
export type CreateFuelSiteInput  = z.infer<typeof createFuelSiteSchema>;
export type UpdateFuelSiteInput  = z.infer<typeof updateFuelSiteSchema>;
export type ListFuelSitesQuery   = z.infer<typeof listFuelSitesSchema>;
