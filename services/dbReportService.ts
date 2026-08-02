import { mssqlQuery } from "./mssqlService";
import { logger } from "./loggerService";

// ─── Raw data types from the SQL database ─────────────────────────────────────
//
// These interfaces describe the EXACT JSON shape that `fetchReportDataFromDb`
// must return after querying the SQL database. The transformation layer
// (`transformDbDataToReportContent`) maps this shape into the MongoDB report
// content format — nothing else in the codebase touches these types.
//
// When implementing `fetchReportDataFromDb`, execute your SQL query(ies) and
// populate a `DbReportRawData` object matching these interfaces exactly.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One operational row per station unit for the report date.
 * Each row maps to a single entry inside the station's unit list in the
 * report content (i.e. one element of a `stationRowSchema` array).
 */
export interface DbUnitRow {
  // ── Identity ────────────────────────────────────────────────────────────────

  /** Human-readable station display name (e.g. "Ramat Hovav"). */
  stationName: string;

  /**
   * Ownership type — controls which top-level bucket the row goes into.
   * "iec"     → report content `.iec`
   * "private" → report content `.private`
   */
  stationType: "iec" | "private";

  /**
   * Primary fuel / technology key. Must be one of the `StationFuel` enum
   * values: "gas" | "diesel" | "solar" | "turbine" | "coal" | "hydro" |
   * "wind" | "nuclear" | "mazut" | "methanol" | "other".
   */
  mainFuel: string;

  /**
   * Secondary / backup fuel keys (same enum). Omit or leave empty when the
   * unit has no backup fuels.
   */
  secondaryFuels?: string[];

  // ── Optional catalog linkage ─────────────────────────────────────────────────
  // These are snapshot / traceability fields only. The report stores a frozen
  // copy of catalog values at creation time and never re-syncs from the catalog.

  /** MongoDB ObjectId (24-char hex) of the Station catalog entry, if known. */
  stationId?: string;
  /** MongoDB ObjectId (24-char hex) of the Unit catalog entry, if known. */
  unitId?: string;

  // ── Operating data for the report date ──────────────────────────────────────

  /** Unit sequence number within the station (e.g. 1, 2, 3). */
  unitNumber: number;

  /** Nameplate installed capacity (MW). */
  installedCapacity: number;

  /** Capacity actually available for dispatch on the report date (MW). */
  availableCapacity: number;

  /** Peak output achieved / expected on the report date (MW). */
  peakCapacity: number;

  /** Minimum-reserve capacity (MW). */
  minReserveCapacity: number;

  /**
   * Peak capacity when the unit is running on a secondary fuel (MW).
   * Set to 0 when the unit has no secondary fuel.
   */
  secondaryFuelPeakCapacity: number;

  /** Operational status on the report date. */
  status: "Active" | "Inactive" | "Maintenance";

  /**
   * Time the unit came online or is scheduled to (24h "HH:MM").
   * Omit if not recorded.
   */
  startTime?: string;

  /**
   * Scheduled shutdown time (24h "HH:MM").
   * Omit if not recorded.
   */
  endTime?: string;

  /**
   * Revised shutdown time if it was updated after the initial plan
   * (24h "HH:MM"). Omit if unchanged.
   */
  updatedEndTime?: string;

  /** Free-text operational notes for this unit. */
  notes?: string;
}

/**
 * Yesterday's energy production summary + weather snapshot.
 * Maps directly to the report content `archive` block.
 */
export interface DbArchiveRow {
  /** The date these totals represent — ISO "YYYY-MM-DD". */
  date: string;

  /** Hebrew weekday name (e.g. "יום שני"). */
  dayName: string;

  /**
   * Hour at which national consumption peaked (24h "HH:MM").
   * Omit if not recorded.
   */
  peakConsumptionHour?: string;

  /**
   * Total energy produced, broken down by fuel key (MWh).
   * Keys must be valid `StationFuel` values. Missing keys default to 0.
   * Example: { "gas": 12345, "solar": 432, "coal": 678 }
   */
  totalsMwhByFuel?: Record<string, number>;

  /** Total renewable energy (solar + wind + hydro) produced (MWh). */
  renewableMwh: number;

  /** Total IEC-owned generation (MWh). */
  totalIecMwh: number;

  /** Total private-producer generation (MWh). */
  totalPrivateMwh: number;

  /** Ambient weather recorded at (or near) the peak consumption hour. */
  weather: {
    /** Ambient temperature in Celsius. */
    temperatureC: number;
    /** "Feels like" temperature in Celsius. */
    feelsLikeC: number;
    /** Relative humidity, 0–100. */
    humidityPct: number;
  };
}

/**
 * Same calendar day one year prior — energy summary + weather snapshot.
 * Maps directly to the report content `lastYearArchive` block.
 */
export interface DbLastYearArchiveRow {
  /** ISO "YYYY-MM-DD" — the historical date (one year before report date). */
  date: string;

  /** Hebrew weekday name. */
  dayName: string;

  /**
   * Hour of peak consumption (24h "HH:MM"). Omit if not recorded.
   */
  peakConsumptionHour?: string;

  /**
   * Peak instantaneous national consumption (MW) at `peakConsumptionHour`.
   * Omit if not recorded.
   */
  peakConsumptionMw?: number;

  /** Total IEC-owned generation (MWh). */
  totalIecMwh: number;

  /** Total private-producer generation (MWh). */
  totalPrivateMwh: number;

  /** Combined total generation (IEC + private) (MWh). */
  totalMwh: number;

  /** Ambient weather at (or near) the peak consumption hour. */
  weather: {
    temperatureC: number;
    feelsLikeC: number;
    humidityPct: number;
  };

  /**
   * Year-to-date energy growth percentage compared to the same period
   * two years ago (e.g. 2.5 = +2.5 %). Omit if not available.
   */
  ytdEnergyGrowthPct?: number;
}

/**
 * One fuel tank / inventory row.
 * Maps directly to a single entry in the report content `fuels` array
 * (`fuelRowSchema`).
 */
export interface DbFuelInventoryRow {
  /**
   * Stable unique identifier for this row — used as a React key on the
   * frontend. Must be unique within the response. Suggested pattern:
   * `"${stationTag}-${tankType}"` or a numeric DB primary key cast to string.
   */
  id: string;

  /** Short catalog tag of the fuel site (matches `FuelSite.tag`). */
  stationTag: string;

  /** Human-readable fuel site display name. */
  stationName: string;

  /**
   * Fuel type key — must be a valid `StationFuel` value or an empty string
   * ("") when the row is still being filled in.
   */
  fuelType: string;

  /** Tank label or type description (e.g. "Main Tank", "Reserve"). */
  tankType: string;

  /**
   * Available fuel volume excluding the dead-stock reserve.
   * Units: typically m³ or tonnes — use whatever the DB stores; the frontend
   * displays the raw number without conversion.
   */
  available: number;

  /** Dead-stock / bottom-reserve volume (same units as `available`). */
  bottom: number;
}

/**
 * Top-level raw data object returned by `fetchReportDataFromDb`.
 * This is the **single source of truth** for the SQL → MongoDB transformation.
 *
 * Full example (all optional sections included):
 *
 * ```json
 * {
 *   "reportDate": "2026-08-02",
 *   "units": [
 *     {
 *       "stationName": "Ramat Hovav",
 *       "stationType": "iec",
 *       "mainFuel": "gas",
 *       "secondaryFuels": ["mazut"],
 *       "stationId": "6649f2a1c3b4d500123abc01",
 *       "unitId":    "6649f2a1c3b4d500123abc02",
 *       "unitNumber": 1,
 *       "installedCapacity": 400,
 *       "availableCapacity": 380,
 *       "peakCapacity": 390,
 *       "minReserveCapacity": 200,
 *       "secondaryFuelPeakCapacity": 350,
 *       "status": "Active",
 *       "startTime": "06:00",
 *       "endTime": "22:00",
 *       "updatedEndTime": "23:00",
 *       "notes": "Running at reduced output due to maintenance window"
 *     }
 *   ],
 *   "archive": {
 *     "date": "2026-08-01",
 *     "dayName": "יום שבת",
 *     "peakConsumptionHour": "14:30",
 *     "totalsMwhByFuel": { "gas": 12345, "solar": 432, "coal": 678 },
 *     "renewableMwh": 432,
 *     "totalIecMwh": 9876,
 *     "totalPrivateMwh": 1234,
 *     "weather": { "temperatureC": 33.5, "feelsLikeC": 36.0, "humidityPct": 55 }
 *   },
 *   "lastYearArchive": {
 *     "date": "2025-08-02",
 *     "dayName": "יום שבת",
 *     "peakConsumptionHour": "15:00",
 *     "peakConsumptionMw": 14500,
 *     "totalIecMwh": 9200,
 *     "totalPrivateMwh": 1100,
 *     "totalMwh": 10300,
 *     "weather": { "temperatureC": 32.0, "feelsLikeC": 34.5, "humidityPct": 60 },
 *     "ytdEnergyGrowthPct": 2.5
 *   },
 *   "fuelInventory": [
 *     {
 *       "id": "ramat-hovav-main",
 *       "stationTag": "RH",
 *       "stationName": "Ramat Hovav",
 *       "fuelType": "mazut",
 *       "tankType": "Main Tank",
 *       "available": 15000,
 *       "bottom": 500
 *     }
 *   ]
 * }
 * ```
 */
export interface DbReportRawData {
  /** The date this data represents — ISO "YYYY-MM-DD". */
  reportDate: string;

  /**
   * All station/unit operational rows for the report date.
   * Must contain at least one entry for the report to have content.
   */
  units: DbUnitRow[];

  /**
   * Optional: yesterday's energy production + weather summary.
   * When present, populates the report's `archive` block.
   */
  archive?: DbArchiveRow;

  /**
   * Optional: same calendar day one year prior.
   * When present, populates the report's `lastYearArchive` block.
   */
  lastYearArchive?: DbLastYearArchiveRow;

  /**
   * Optional: per-tank fuel inventory rows.
   * When present, populates the report's `fuels` block.
   */
  fuelInventory?: DbFuelInventoryRow[];
}

// ─── Stub: fetch from SQL DB ──────────────────────────────────────────────────

/**
 * **NOT IMPLEMENTED — implement this function in the closed system.**
 *
 * Fetches all report data for the given date from the SQL database and
 * returns it as a `DbReportRawData` object. Returns `null` when no data is
 * found for the requested date or when the database is unreachable.
 *
 * ─── Implementation guidelines ────────────────────────────────────────────────
 *
 * 1. Use `mssqlQuery` (imported above) to run parameterized queries.
 *    NEVER build SQL strings by concatenating user input — always use `@param`
 *    named parameters to prevent SQL injection.
 *
 * 2. The returned object MUST conform to `DbReportRawData`. Populate every
 *    required field on `DbUnitRow`. Optional sections (`archive`,
 *    `lastYearArchive`, `fuelInventory`) can be omitted when the DB has no
 *    data for them — the transformer handles `undefined` gracefully.
 *
 * 3. `stationType` must be exactly `"iec"` or `"private"` — map your DB
 *    values to this enum before returning.
 *
 * 4. `mainFuel` and `fuelType` values must match the `StationFuel` enum:
 *    "gas" | "diesel" | "solar" | "turbine" | "coal" | "hydro" | "wind" |
 *    "nuclear" | "mazut" | "methanol" | "other"
 *    Map / normalise your DB strings to these values before returning.
 *
 * 5. All time strings (`startTime`, `endTime`, `updatedEndTime`,
 *    `peakConsumptionHour`) must be in 24h "HH:MM" format.
 *
 * 6. All capacity / energy values must be numbers (not strings). Parse or
 *    CAST as needed in SQL or in JS before building the return object.
 *
 * 7. `id` values in `fuelInventory` must be unique within the array and
 *    stable across calls for the same date — a composite of tag + tankType
 *    or the DB primary key cast to string works well.
 *
 * ─── Example query sketch ─────────────────────────────────────────────────────
 *
 *   const result = await mssqlQuery<{ ... }>(
 *     `SELECT
 *        StationName, StationType, MainFuel, UnitNumber,
 *        InstalledCapacity, AvailableCapacity, PeakCapacity,
 *        MinReserveCapacity, SecondaryFuelPeakCapacity,
 *        OperationalStatus, StartTime, EndTime
 *      FROM dbo.DailyUnitData
 *      WHERE ReportDate = @date`,
 *     { date: reportDate },
 *   );
 *
 *   // ... map result.recordset → DbUnitRow[] and build DbReportRawData ...
 *
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * @param reportDate  The date to fetch data for (time component is ignored).
 * @returns           Populated `DbReportRawData`, or `null` on no-data / error.
 */
export async function fetchReportDataFromDb(
  reportDate: Date,
): Promise<DbReportRawData | null> {
  const dateStr = reportDate.toISOString().slice(0, 10);

  console.log(
    `[dbReportService] fetchReportDataFromDb called for date: ${dateStr}` +
    ` — NOT IMPLEMENTED. Implement this function to query the SQL database` +
    ` and return a DbReportRawData object.`,
  );

  // ── TODO: implement ────────────────────────────────────────────────────────
  // Replace the `return null` below with your SQL queries + data mapping.
  // The `mssqlQuery` helper is available (imported above).
  //
  // Minimum viable implementation:
  //   1. Query dbo.<your table> WHERE ReportDate = @date
  //   2. If result.recordset is empty → return null
  //   3. Map rows → DbUnitRow[]
  //   4. Optionally query archive / fuel-inventory tables
  //   5. Return the assembled DbReportRawData object
  // ──────────────────────────────────────────────────────────────────────────

  void mssqlQuery; // keep import alive until the function is implemented
  void dateStr;

  return null;
}

// ─── Transformation ───────────────────────────────────────────────────────────

/**
 * Converts a `DbReportRawData` object (raw SQL output) into the report
 * `content` shape expected by `reportContentSchema` / the MongoDB model.
 *
 * This function is fully implemented — only `fetchReportDataFromDb` above
 * needs to be wired to the real SQL database.
 */
export function transformDbDataToReportContent(
  raw: DbReportRawData,
): Record<string, unknown> {
  // ── 1. Station / unit rows ────────────────────────────────────────────────
  //
  // Target shape:
  //   content.iec["gas"]["Station A"] = [unitRow, unitRow, ...]
  //   content.private["diesel"]["Station B"] = [unitRow, ...]
  //
  const iec: Record<string, Record<string, unknown[]>> = {};
  const priv: Record<string, Record<string, unknown[]>> = {};

  for (const row of raw.units) {
    const bucket = row.stationType === "iec" ? iec : priv;

    if (!bucket[row.mainFuel]) {
      bucket[row.mainFuel] = {};
    }
    const fuelBucket = bucket[row.mainFuel]!;
    if (!fuelBucket[row.stationName]) {
      fuelBucket[row.stationName] = [];
    }

    fuelBucket[row.stationName]!.push({
      stationNumber:             row.unitNumber,
      installedCapacity:         row.installedCapacity,
      availableCapacity:         row.availableCapacity,
      peakCapacity:              row.peakCapacity,
      minReserveCapacity:        row.minReserveCapacity,
      secondaryFuelPeakCapacity: row.secondaryFuelPeakCapacity,
      status:                    row.status,
      ...(row.startTime       && { startTime:       row.startTime }),
      ...(row.endTime         && { endTime:         row.endTime }),
      ...(row.updatedEndTime  && { updatedEndTime:  row.updatedEndTime }),
      ...(row.notes           && { notes:           row.notes }),
      ...(row.stationId       && { stationId:       row.stationId }),
      ...(row.unitId          && { unitId:          row.unitId }),
      ...(row.stationName     && { stationName:     row.stationName }),
      ...(row.mainFuel        && { mainFuel:        row.mainFuel }),
      ...(row.secondaryFuels?.length && { secondaryFuels: row.secondaryFuels }),
    });
  }

  // ── 2. Archive block ──────────────────────────────────────────────────────
  const archive = raw.archive
    ? {
        date:                raw.archive.date,
        dayName:             raw.archive.dayName,
        peakConsumptionHour: raw.archive.peakConsumptionHour ?? "",
        totalsMwhByFuel:     raw.archive.totalsMwhByFuel ?? {},
        renewableMwh:        raw.archive.renewableMwh,
        totalIecMwh:         raw.archive.totalIecMwh,
        totalPrivateMwh:     raw.archive.totalPrivateMwh,
        weather:             raw.archive.weather,
      }
    : undefined;

  // ── 3. Last year archive block ────────────────────────────────────────────
  const lastYearArchive = raw.lastYearArchive
    ? {
        date:                raw.lastYearArchive.date,
        dayName:             raw.lastYearArchive.dayName,
        peakConsumptionHour: raw.lastYearArchive.peakConsumptionHour ?? "",
        peakConsumptionMw:   raw.lastYearArchive.peakConsumptionMw ?? 0,
        totalIecMwh:         raw.lastYearArchive.totalIecMwh,
        totalPrivateMwh:     raw.lastYearArchive.totalPrivateMwh,
        totalMwh:            raw.lastYearArchive.totalMwh,
        weather:             raw.lastYearArchive.weather,
        ytdEnergyGrowthPct:  raw.lastYearArchive.ytdEnergyGrowthPct ?? 0,
      }
    : undefined;

  // ── 4. Fuel inventory block ───────────────────────────────────────────────
  const fuels = raw.fuelInventory?.map((row) => ({
    id:          row.id,
    stationTag:  row.stationTag,
    stationName: row.stationName,
    fuelType:    row.fuelType,
    tankType:    row.tankType,
    available:   row.available,
    bottom:      row.bottom,
  }));

  // ── 5. Assemble ───────────────────────────────────────────────────────────
  return {
    iec:  iec,
    private: priv,
    ...(archive         && { archive }),
    ...(lastYearArchive && { lastYearArchive }),
    ...(fuels?.length   && { fuels }),
  };
}

// ─── Per-section types ────────────────────────────────────────────────────────
//
// These interfaces describe the raw data that each per-section stub function
// must return. Each section has its own type tailored to what the SQL DB is
// expected to provide. The API controller transforms these into the
// frontend-compatible section response before sending them over the wire.
// ─────────────────────────────────────────────────────────────────────────────

/** Section name discriminator used by the `GET /reports/db-section` endpoint. */
export type DbSectionName = "private" | "iec" | "forecast" | "archive" | "fuels";

/**
 * Raw forecast data from the SQL DB for the "forecast" section.
 *
 * The shape mirrors the frontend `ForecastBlock` type. The controller passes
 * it through to the client without any further transformation — populate it
 * exactly as shown in the JSON example below.
 *
 * ```json
 * {
 *   "load": {
 *     "today":    { "value": 14200, "peakHour": "14:30", "minReserveValue": 9800, "minReserveHour": "05:00" },
 *     "tomorrow": { "value": 14500, "peakHour": "15:00", "minReserveValue": 9900, "minReserveHour": "05:30" }
 *   },
 *   "weather": {
 *     "region": "gush-dan",
 *     "today":    { "temperatureC": 33, "feelsLikeC": 36, "humidityPct": 55, "description": "חם וחמסיני" },
 *     "tomorrow": { "temperatureC": 31, "feelsLikeC": 34, "humidityPct": 60, "description": "חם" }
 *   }
 * }
 * ```
 */
export interface DbForecastRaw {
  load: {
    /** Today's load forecast figures. */
    today: {
      /** Forecasted peak national load (MW). */
      value: number;
      /** Hour of the peak load (24h "HH:MM"). */
      peakHour: string;
      /** Forecasted load (MW) at the minimal-reserve hour. */
      minReserveValue: number;
      /** Hour of the minimal reserve (24h "HH:MM"). */
      minReserveHour: string;
    };
    /** Tomorrow's load forecast figures (same fields as today). */
    tomorrow: {
      value: number;
      peakHour: string;
      minReserveValue: number;
      minReserveHour: string;
    };
  };
  weather: {
    /**
     * Region identifier (e.g. "gush-dan"). Used to label the weather widget.
     * Use the same string as `EXTERNAL_WEATHER_REGION` in your .env if available.
     */
    region: string;
    /** Today's weather at the expected peak consumption hour. */
    today: {
      temperatureC: number;
      feelsLikeC: number;
      humidityPct: number;
      /** Short Hebrew weather description (e.g. "שמשי", "חם וחמסיני"). */
      description: string;
    };
    /** Tomorrow's weather forecast. */
    tomorrow: {
      temperatureC: number;
      feelsLikeC: number;
      humidityPct: number;
      description: string;
    };
  };
}

/**
 * Raw archive data returned by `fetchArchiveSectionFromDb`.
 * Contains yesterday's energy/weather summary and optionally the same
 * calendar day one year prior for a year-over-year comparison widget.
 */
export interface DbArchiveSectionRaw {
  /** Yesterday's production + weather data (maps to `content.archive`). */
  archive: DbArchiveRow;
  /**
   * Same calendar day one year prior (maps to `content.lastYearArchive`).
   * Omit when not available — the frontend renders an empty last-year block.
   */
  lastYearArchive?: DbLastYearArchiveRow;
}

// ─── Per-section stub functions ───────────────────────────────────────────────

/**
 * **NOT IMPLEMENTED — implement this function in the closed system.**
 *
 * Returns only the private-producer station/unit rows for the given date.
 * All returned rows MUST have `stationType === "private"`.
 *
 * ─── Implementation guidelines ────────────────────────────────────────────────
 * • Same rules as `fetchReportDataFromDb` — use `mssqlQuery` with named params.
 * • Filter by ownership type (private) in your WHERE clause.
 * • Return `null` when no rows are found or the query fails.
 * • Each `DbUnitRow` must have `stationType: "private"`.
 * • All capacity fields must be numbers; `status` must be "Active" | "Inactive" | "Maintenance".
 *
 * Example return shape: `DbUnitRow[]` — see `DbUnitRow` definition above.
 * ──────────────────────────────────────────────────────────────────────────────
 */
export async function fetchPrivateSectionFromDb(
  reportDate: Date,
): Promise<DbUnitRow[] | null> {
  const dateStr = reportDate.toISOString().slice(0, 10);

  console.log(
    `[dbReportService] fetchPrivateSectionFromDb called for date: ${dateStr}` +
    ` — NOT IMPLEMENTED. Return DbUnitRow[] with stationType="private".`,
  );

  // ── TODO: implement ────────────────────────────────────────────────────────
  // Example:
  //   const result = await mssqlQuery<{ ... }>(
  //     `SELECT ... FROM dbo.DailyUnitData WHERE ReportDate = @date AND StationType = 'private'`,
  //     { date: dateStr },
  //   );
  //   if (result.recordset.length === 0) return null;
  //   return result.recordset.map(r => ({ stationType: "private", ... }));
  // ──────────────────────────────────────────────────────────────────────────
  void dateStr;
  return null;
}

/**
 * **NOT IMPLEMENTED — implement this function in the closed system.**
 *
 * Returns only the IEC-owned station/unit rows for the given date.
 * All returned rows MUST have `stationType === "iec"`.
 *
 * ─── Implementation guidelines ────────────────────────────────────────────────
 * Same as `fetchPrivateSectionFromDb`, but filter by `StationType = 'iec'`.
 * ──────────────────────────────────────────────────────────────────────────────
 */
export async function fetchIecSectionFromDb(
  reportDate: Date,
): Promise<DbUnitRow[] | null> {
  const dateStr = reportDate.toISOString().slice(0, 10);

  console.log(
    `[dbReportService] fetchIecSectionFromDb called for date: ${dateStr}` +
    ` — NOT IMPLEMENTED. Return DbUnitRow[] with stationType="iec".`,
  );

  // ── TODO: implement ────────────────────────────────────────────────────────
  void dateStr;
  return null;
}

/**
 * **NOT IMPLEMENTED — implement this function in the closed system.**
 *
 * Returns today's and tomorrow's load forecast + weather data from the DB.
 *
 * ─── Implementation guidelines ────────────────────────────────────────────────
 * • Return a `DbForecastRaw` object — see the interface definition above for
 *   the exact shape and a full JSON example.
 * • `load.today` / `load.tomorrow` values are in MW.
 * • `weather.today` / `weather.tomorrow` temperatures in Celsius.
 * • `peakHour` / `minReserveHour` must be 24h "HH:MM" strings.
 * • Return `null` if no forecast data exists for this date.
 * ──────────────────────────────────────────────────────────────────────────────
 */
export async function fetchForecastSectionFromDb(
  reportDate: Date,
): Promise<DbForecastRaw | null> {
  const dateStr = reportDate.toISOString().slice(0, 10);

  console.log(
    `[dbReportService] fetchForecastSectionFromDb called for date: ${dateStr}` +
    ` — NOT IMPLEMENTED. Return DbForecastRaw with load + weather forecast.`,
  );

  // ── TODO: implement ────────────────────────────────────────────────────────
  void dateStr;
  return null;
}

/**
 * **NOT IMPLEMENTED — implement this function in the closed system.**
 *
 * Returns the archive summary for the given date (yesterday's energy totals
 * + weather) and optionally the same calendar day one year prior.
 *
 * ─── Implementation guidelines ────────────────────────────────────────────────
 * • `archive.date` must be the day BEFORE `reportDate` (i.e. yesterday's date).
 * • `archive.totalsMwhByFuel` keys must be valid `StationFuel` enum values.
 * • `archive.dayName` is the Hebrew weekday name (e.g. "יום ראשון").
 * • `lastYearArchive` is optional — omit when not available.
 * • Return `null` if no archive data exists for this date.
 * ──────────────────────────────────────────────────────────────────────────────
 */
export async function fetchArchiveSectionFromDb(
  reportDate: Date,
): Promise<DbArchiveSectionRaw | null> {
  const dateStr = reportDate.toISOString().slice(0, 10);

  console.log(
    `[dbReportService] fetchArchiveSectionFromDb called for date: ${dateStr}` +
    ` — NOT IMPLEMENTED. Return DbArchiveSectionRaw with archive (+ optional lastYearArchive).`,
  );

  // ── TODO: implement ────────────────────────────────────────────────────────
  void dateStr;
  return null;
}

/**
 * **NOT IMPLEMENTED — implement this function in the closed system.**
 *
 * Returns per-tank fuel inventory rows for the given date.
 *
 * ─── Implementation guidelines ────────────────────────────────────────────────
 * • Each `DbFuelInventoryRow.id` must be unique within the returned array.
 * • `fuelType` must be a valid `StationFuel` value (or empty string "").
 * • `available` and `bottom` are raw numeric values (no unit conversion).
 * • Return `null` if no fuel inventory data exists for this date.
 * ──────────────────────────────────────────────────────────────────────────────
 */
export async function fetchFuelsSectionFromDb(
  reportDate: Date,
): Promise<DbFuelInventoryRow[] | null> {
  const dateStr = reportDate.toISOString().slice(0, 10);

  console.log(
    `[dbReportService] fetchFuelsSectionFromDb called for date: ${dateStr}` +
    ` — NOT IMPLEMENTED. Return DbFuelInventoryRow[].`,
  );

  // ── TODO: implement ────────────────────────────────────────────────────────
  void dateStr;
  return null;
}

// ─── Shared transformation helpers ───────────────────────────────────────────

/**
 * Builds a fuel-keyed station bucket from a `DbUnitRow[]`.
 * Output shape: `{ [mainFuel]: { [stationName]: unitRow[] } }`
 * The frontend's `normalizeReportContent` automatically migrates this
 * fuel-keyed format to the group-keyed format it uses for rendering.
 */
export function buildStationBucketFromUnits(
  units: DbUnitRow[],
): Record<string, Record<string, unknown[]>> {
  const bucket: Record<string, Record<string, unknown[]>> = {};

  for (const row of units) {
    if (!bucket[row.mainFuel]) {
      bucket[row.mainFuel] = {};
    }
    const fuelBucket = bucket[row.mainFuel]!;
    if (!fuelBucket[row.stationName]) {
      fuelBucket[row.stationName] = [];
    }
    fuelBucket[row.stationName]!.push({
      stationNumber:             row.unitNumber,
      installedCapacity:         row.installedCapacity,
      availableCapacity:         row.availableCapacity,
      peakCapacity:              row.peakCapacity,
      minReserveCapacity:        row.minReserveCapacity,
      secondaryFuelPeakCapacity: row.secondaryFuelPeakCapacity,
      status:                    row.status,
      ...(row.startTime      && { startTime:       row.startTime }),
      ...(row.endTime        && { endTime:         row.endTime }),
      ...(row.updatedEndTime && { updatedEndTime:  row.updatedEndTime }),
      ...(row.notes          && { notes:           row.notes }),
      ...(row.stationId      && { stationId:       row.stationId }),
      ...(row.unitId         && { unitId:          row.unitId }),
      ...(row.stationName    && { stationName:     row.stationName }),
      ...(row.mainFuel       && { mainFuel:        row.mainFuel }),
      ...(row.secondaryFuels?.length && { secondaryFuels: row.secondaryFuels }),
    });
  }

  return bucket;
}

/** Transforms a `DbArchiveRow` to the schema-compatible archive block shape. */
export function transformArchiveRow(row: DbArchiveRow): Record<string, unknown> {
  return {
    date:                row.date,
    dayName:             row.dayName,
    peakConsumptionHour: row.peakConsumptionHour ?? "",
    totalsMwhByFuel:     row.totalsMwhByFuel ?? {},
    renewableMwh:        row.renewableMwh,
    totalIecMwh:         row.totalIecMwh,
    totalPrivateMwh:     row.totalPrivateMwh,
    weather:             row.weather,
  };
}

/** Transforms a `DbLastYearArchiveRow` to the schema-compatible block shape. */
export function transformLastYearArchiveRow(row: DbLastYearArchiveRow): Record<string, unknown> {
  return {
    date:                row.date,
    dayName:             row.dayName,
    peakConsumptionHour: row.peakConsumptionHour ?? "",
    peakConsumptionMw:   row.peakConsumptionMw ?? 0,
    totalIecMwh:         row.totalIecMwh,
    totalPrivateMwh:     row.totalPrivateMwh,
    totalMwh:            row.totalMwh,
    weather:             row.weather,
    ytdEnergyGrowthPct:  row.ytdEnergyGrowthPct ?? 0,
  };
}
