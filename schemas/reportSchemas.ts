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
  // These are purely informational here — they let consumers know that
  // `installedCapacity`, `mainFuel` and `secondaryFuels` came from the
  // catalog and shouldn't be edited inline. The report itself never
  // mutates the catalog; the catalog mutates these defaults via its own
  // settings page. ──
  stationId:      objectIdString.optional(),
  unitId:         objectIdString.optional(),
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

const reportContentSchema = z.object({
  private:  fuelBucketSchema.optional().default({}),
  iec:      fuelBucketSchema.optional().default({}),
  forecast: forecastSchema.optional(),
});

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
