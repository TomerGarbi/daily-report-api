import { Request, Response } from "express";
import { Weather } from "../models/Weather";
import type { WeatherForecastQuery } from "../schemas/weatherSchemas";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** UTC midnight of the given date. */
function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Add `n` days to a UTC midnight date. */
function addUtcDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

// ─── GET /weather/forecast ────────────────────────────────────────────────────

/**
 * Returns weather snapshots for `today` and `tomorrow` (UTC days) for the
 * given region. Each day is `null` when no snapshot exists — callers decide
 * whether to surface that as a hint or fall back to manual entry.
 *
 * Response 200: `{ region, today: WeatherSnapshot | null, tomorrow: WeatherSnapshot | null }`
 */
export const getWeatherForecastHandler = async (req: Request, res: Response): Promise<void> => {
  const { region } = req.query as unknown as WeatherForecastQuery;

  const today    = utcMidnight(new Date());
  const tomorrow = addUtcDays(today, 1);

  const [todayDoc, tomorrowDoc] = await Promise.all([
    Weather.findOne({ region, date: today }).lean(),
    Weather.findOne({ region, date: tomorrow }).lean(),
  ]);

  const project = (doc: typeof todayDoc) =>
    doc
      ? {
          temperatureC: doc.temperatureC,
          feelsLikeC:   doc.feelsLikeC,
          humidityPct:  doc.humidityPct,
          date:         doc.date.toISOString(),
        }
      : null;

  res.status(200).json({
    region,
    fetchedAt: new Date().toISOString(),
    today:    project(todayDoc),
    tomorrow: project(tomorrowDoc),
  });
};
