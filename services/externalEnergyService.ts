import { logger } from "./loggerService";
import type { StationFuel } from "../models/Station";

/**
 * Result of querying yesterday's energy production from an external system.
 *
 * - `peakHour` — the hour at which yesterday's national consumption peaked,
 *   formatted as "HH:MM" (24h). Used by the controller to look up the
 *   weather snapshot for the same hour.
 * - `totalsMwhByFuel` — total energy produced yesterday, broken down by
 *   fuel. Keys correspond to `StationFuel`. Missing keys default to 0 in
 *   the consumer.
 * - `totalIecMwh` / `totalPrivateMwh` — totals split by ownership, when
 *   the upstream API exposes that breakdown. May be `null` if it doesn't.
 */
export interface YesterdayEnergyTotals {
  peakHour: string | null;
  totalsMwhByFuel: Partial<Record<StationFuel, number>>;
  totalIecMwh: number | null;
  totalPrivateMwh: number | null;
  /** Peak instantaneous consumption (MW) at `peakHour`. Null when upstream
   *  doesn't expose it. */
  peakConsumptionMw: number | null;
  /** Year-to-date energy growth percentage compared to the same period
   *  last year (e.g. `2.5` = +2.5%). Null when not provided by upstream. */
  ytdEnergyGrowthPct: number | null;
}

/**
 * Pulls yesterday's energy production totals from the configured external
 * energy data source. Returns `null` when the integration is not configured
 * or the upstream call fails — the caller is expected to render an empty
 * state in that case rather than surface an error to the user.
 *
 * Configure with the following env vars:
 *   - EXTERNAL_ENERGY_API_URL   (required for the call to be attempted)
 *   - EXTERNAL_ENERGY_API_KEY   (optional; sent as Bearer token)
 *
 * The expected upstream JSON shape is documented inline below — adapt the
 * mapping in this single function when wiring a real provider (Noga,
 * data.gov.il, etc.).
 */
export async function getYesterdayEnergyTotals(): Promise<YesterdayEnergyTotals | null> {
  return fetchEnergy(process.env.EXTERNAL_ENERGY_API_URL);
}

/**
 * Same as `getYesterdayEnergyTotals` but for an arbitrary historical date.
 * The upstream URL is called with `?date=YYYY-MM-DD` appended. Used by the
 * "same day last year" archive comparison.
 */
export async function getEnergyForDate(date: Date): Promise<YesterdayEnergyTotals | null> {
  const baseUrl = process.env.EXTERNAL_ENERGY_API_URL;
  if (!baseUrl) return null;
  const dateStr = date.toISOString().slice(0, 10);
  const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}date=${dateStr}`;
  return fetchEnergy(url);
}

async function fetchEnergy(url: string | undefined): Promise<YesterdayEnergyTotals | null> {
  if (!url) {
    return null;
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.EXTERNAL_ENERGY_API_KEY) {
    headers.Authorization = `Bearer ${process.env.EXTERNAL_ENERGY_API_KEY}`;
  }

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      logger.warn(
        `External energy API returned ${res.status}`,
        "externalEnergyService",
        { status: res.status },
      );
      return null;
    }
    const raw = (await res.json()) as unknown;
    return normalizeEnergyResponse(raw);
  } catch (err) {
    logger.error(
      "External energy API call failed",
      "externalEnergyService",
      { error: err instanceof Error ? err.message : String(err) },
    );
    return null;
  }
}

/**
 * Defensively normalize the upstream response into our internal shape.
 *
 * Accepts either:
 *   { peakHour: "14:30",
 *     totalsMwhByFuel: { gas: 123, ... },
 *     totalIecMwh: 999, totalPrivateMwh: 222 }
 *
 * or a flatter shape:
 *   { peakHour: "14:30", gas: 123, diesel: 45, ..., iec: 999, private: 222 }
 *
 * Unknown keys are ignored. Non-numeric values are coerced to 0.
 */
function normalizeEnergyResponse(raw: unknown): YesterdayEnergyTotals {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const peakHour = typeof obj.peakHour === "string" ? obj.peakHour : null;

  const fuelKeys: StationFuel[] = [
    "gas", "diesel", "solar", "turbine", "coal", "hydro",
    "wind", "nuclear", "mazut", "methanol", "other",
  ];

  const nestedTotals = (obj.totalsMwhByFuel ?? null) as Record<string, unknown> | null;
  const source = nestedTotals && typeof nestedTotals === "object" ? nestedTotals : obj;

  const totalsMwhByFuel: Partial<Record<StationFuel, number>> = {};
  for (const k of fuelKeys) {
    const v = source[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      totalsMwhByFuel[k] = v;
    }
  }

  const totalIecMwh =
    typeof obj.totalIecMwh === "number" ? obj.totalIecMwh :
    typeof obj.iec === "number" ? obj.iec : null;

  const totalPrivateMwh =
    typeof obj.totalPrivateMwh === "number" ? obj.totalPrivateMwh :
    typeof obj.private === "number" ? obj.private : null;

  const peakConsumptionMw =
    typeof obj.peakConsumptionMw === "number" ? obj.peakConsumptionMw :
    typeof obj.peakDemandMw === "number" ? obj.peakDemandMw :
    typeof obj.peakLoad === "number" ? obj.peakLoad : null;

  const ytdEnergyGrowthPct =
    typeof obj.ytdEnergyGrowthPct === "number" ? obj.ytdEnergyGrowthPct :
    typeof obj.ytdGrowthPct === "number" ? obj.ytdGrowthPct : null;

  return {
    peakHour, totalsMwhByFuel, totalIecMwh, totalPrivateMwh,
    peakConsumptionMw, ytdEnergyGrowthPct,
  };
}
