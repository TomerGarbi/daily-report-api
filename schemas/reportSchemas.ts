import { z } from "zod";

// ─── Station / content schemas ────────────────────────────────────────────────

const objectIdString = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Must be a valid ObjectId");

const stationFuelValues = [
  "gas",
  "diesel",
  "solar",
  "turbine",
  "coal",
  "hydro",
  "wind",
  "nuclear",
  "mazut",
  "methanol",
  "other",
] as const;

const stationRowSchema = z.object({
  stationNumber:             z.number().int().min(1),
  installedCapacity:         z.number().min(0),
  availableCapacity:         z.number().min(0),
  peakCapacity:              z.number().min(0),
  minReserveCapacity:        z.number().min(0),
  secondaryFuelPeakCapacity: z.number().min(0),
  status:                    z.enum(["Active", "Inactive", "Maintenance"]),
  startTime:                 z.string().optional(),
  endTime:                   z.string().optional(),
  updatedEndTime:            z.string().optional(),
  notes:                     z.string().optional(),

  // ── Optional catalog linkage (set when the row was created from the
  // station/unit catalog managed in /settings/stations).
  //
  // Snapshot semantics: `stationName`, `mainFuel`, `secondaryFuels` and
  // `installedCapacity` are FROZEN COPIES of the catalog values at the
  // moment the row was created. They are never re-synced from the catalog
  // afterwards — later catalog edits (renames, fuel/capacity changes,
  // deletions) do NOT affect existing reports. This keeps historical
  // reports reproducible even if the source station/unit is modified or
  // removed. `stationId` / `unitId` are kept for traceability only and
  // may dangle if the catalog entry is later deleted.
  //
  // The report never writes back to the catalog; the catalog's own
  // settings page is the sole source of edits, which apply only to rows
  // created after the edit. ──
  stationId:      objectIdString.optional(),
  unitId:         objectIdString.optional(),
  stationName:    z.string().max(200).optional(),
  mainFuel:       z.string().max(100).optional(),
  secondaryFuels: z.array(z.string().max(100)).max(10).optional(),
});

const stationDataSchema = z.record(z.string(), z.array(stationRowSchema).min(1));

/**
 * Per-fuel bucket map. Keys are `StationFuel` values, values are `StationData`
 * (station-name → rows). Top-level groups are the station ownership types
 * (`private` / `iec`).
 *
 * Stored as a plain string-keyed record for flexibility — known fuel keys
 * are validated by the frontend; unknown keys are tolerated for forward
 * compatibility (e.g. when a new fuel is added in the catalog).
 */
const stationFuelKey = z.enum(stationFuelValues);
const fuelBucketSchema = z.record(z.string(), stationDataSchema).refine(
  (obj) =>
    Object.keys(obj).every((k) => stationFuelKey.safeParse(k).success),
  { message: "Unknown fuel key in content bucket" },
);

// ─── Forecast schemas ─────────────────────────────────────────────────────────

const hourString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must be HH:MM (24h)");

const forecastDaySchema = z.object({
  /** Forecasted peak load (MW). */
  value:            z.number().nonnegative(),
  /** Hour of the peak load (HH:MM). */
  peakHour:         hourString,
  /** Forecasted load (MW) at the minimal-reserve hour. */
  minReserveValue:  z.number().nonnegative(),
  /** Hour of the minimal reserve (HH:MM). */
  minReserveHour:   hourString,
});

const weatherDaySchema = z.object({
  /** Temperature in Celsius. */
  temperatureC: z.number().min(-50).max(60),
  /** "Feels like" temperature in Celsius. */
  feelsLikeC:   z.number().min(-50).max(60),
  /** Relative humidity, 0–100. */
  humidityPct:  z.number().min(0).max(100),
  /** Free-text weather description. */
  description:  z.string().trim().max(200).default(""),
});

const weatherSourceSchema = z.enum(["db", "manual"]);

const forecastSchema = z.object({
  load: z.object({
    today:    forecastDaySchema,
    tomorrow: forecastDaySchema,
  }),
  weather: z.object({
    region:    z.string().trim().min(1).max(50),
    fetchedAt: z.string().datetime().optional(),
    today:     weatherDaySchema,
    tomorrow:  weatherDaySchema,
    source: z.object({
      today:    weatherSourceSchema,
      tomorrow: weatherSourceSchema,
    }),
  }),
});

export { forecastSchema };

// ─── Archive (yesterday) ─────────────────────────────────────────────────────

/** Per-fuel totals (MWh). Tolerant of unknown keys for forward compat. */
const fuelTotalsSchema = z.record(z.string(), z.number().nonnegative()).refine(
  (obj) =>
    Object.keys(obj).every((k) => stationFuelKey.safeParse(k).success),
  { message: "Unknown fuel key in totalsMwhByFuel" },
);

/** Hour string — accepts HH:MM or empty (prefill may be missing). */
const optionalHourString = z.union([
  z.literal(""),
  hourString,
]);

const archiveWeatherSchema = z.object({
  temperatureC: z.number().min(-50).max(60),
  feelsLikeC:   z.number().min(-50).max(60),
  humidityPct:  z.number().min(0).max(100),
});

const archiveBlockSchema = z.object({
  /** ISO date — informational, not editable. */
  date:                z.string().min(1),
  /** Hebrew day name — informational. */
  dayName:             z.string().max(50),
  peakConsumptionHour: optionalHourString,
  totalsMwhByFuel:     fuelTotalsSchema.optional().default({}),
  renewableMwh:        z.number().nonnegative(),
  totalIecMwh:         z.number().nonnegative(),
  totalPrivateMwh:     z.number().nonnegative(),
  weather:             archiveWeatherSchema,
});

const lastYearArchiveBlockSchema = z.object({
  date:                z.string().min(1),
  dayName:             z.string().max(50),
  peakConsumptionHour: optionalHourString,
  peakConsumptionMw:   z.number().nonnegative(),
  totalIecMwh:         z.number().nonnegative(),
  totalPrivateMwh:     z.number().nonnegative(),
  totalMwh:            z.number().nonnegative(),
  weather:             archiveWeatherSchema,
  /** Year-to-date growth percentage; can be negative. */
  ytdEnergyGrowthPct:  z.number(),
});

export { archiveBlockSchema, lastYearArchiveBlockSchema };

// ─── Fuels (per-tank inventory) ──────────────────────────────────────────────

/** Fuel-type for a tank row. Empty string allowed while the row is being filled in. */
const fuelRowFuelType = z.union([z.literal(""), stationFuelKey]);

const fuelRowSchema = z.object({
  /** Stable client-side id (React key / dedup). */
  id:          z.string().min(1).max(64),
  /** Fuel-site catalog tag. Empty while not yet picked. */
  stationTag:  z.string().max(100),
  /** Denormalized display name from the catalog. */
  stationName: z.string().max(200),
  fuelType:    fuelRowFuelType,
  /** Free-text tank label, typically copied from the FuelSite tank. */
  tankType:    z.string().max(100),
  /** Available amount in the tank (excluding bottom reserve). */
  available:   z.number().nonnegative(),
  /** Un-pumpable "bottom" / dead-stock reserve. */
  bottom:      z.number().nonnegative(),
});

const fuelsBlockSchema = z.array(fuelRowSchema).max(500);

export { fuelRowSchema, fuelsBlockSchema };

// ─── Report content (top-level) ──────────────────────────────────────────────

const reportContentSchema = z.object({
  /** Stations owned by private producers, grouped by primary fuel. */
  private:          fuelBucketSchema.optional().default({}),
  /** Stations owned by Israel Electric Corporation, grouped by primary fuel. */
  iec:              fuelBucketSchema.optional().default({}),
  /** Today / tomorrow load + weather forecast. */
  forecast:         forecastSchema.optional(),
  /** Yesterday's production + weather archive (editable). */
  archive:          archiveBlockSchema.optional(),
  /** Older archived days, ordered from most-recent backwards. */
  archiveExtraDays: z.array(archiveBlockSchema).max(31).optional(),
  /** Same-calendar-day-last-year archive (editable). */
  lastYearArchive:  lastYearArchiveBlockSchema.optional(),
  /** Per-tank fuel inventory rows. */
  fuels:            fuelsBlockSchema.optional(),
});

export { reportContentSchema };

// ─── Create ───────────────────────────────────────────────────────────────────

export const createReportSchema = z.object({
  title:       z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required").max(500),
  content:     reportContentSchema.optional().default(() => ({ private: {}, iec: {} })),
  status:      z.enum(["draft", "published"]).optional().default("published"),
});

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateReportSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(500).optional(),
  content:     reportContentSchema.optional(),
  status:      z.enum(["draft", "published"]).optional(),
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
