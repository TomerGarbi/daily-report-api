import { logger } from "./loggerService";

export interface HourlyWeatherSnapshot {
  temperatureC: number;
  feelsLikeC: number;
  humidityPct: number;
}

/**
 * Fetches the weather snapshot at a specific hour for a given date from a
 * configured external hourly weather provider (e.g. IMS, OpenWeather).
 *
 * Returns `null` when not configured, when the provider has no data for the
 * requested hour, or when the request fails. The caller is expected to
 * degrade gracefully (render zeros / empty state) rather than treat this
 * as an error.
 *
 * Configure with:
 *   - EXTERNAL_WEATHER_API_URL   (required; must accept ?date=YYYY-MM-DD&hour=HH:MM&region=...)
 *   - EXTERNAL_WEATHER_API_KEY   (optional; sent as Bearer token)
 */
export async function getWeatherAt(
  date: Date,
  hour: string,
  region: string,
): Promise<HourlyWeatherSnapshot | null> {
  const baseUrl = process.env.EXTERNAL_WEATHER_API_URL;
  if (!baseUrl) {
    return null;
  }

  const dateStr = date.toISOString().slice(0, 10);
  const params = new URLSearchParams({ date: dateStr, hour, region });

  const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${params.toString()}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.EXTERNAL_WEATHER_API_KEY) {
    headers.Authorization = `Bearer ${process.env.EXTERNAL_WEATHER_API_KEY}`;
  }

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      logger.warn(
        `External weather API returned ${res.status}`,
        "externalWeatherService",
        { status: res.status },
      );
      return null;
    }
    const raw = (await res.json()) as unknown;
    return normalizeWeatherResponse(raw);
  } catch (err) {
    logger.error(
      "External weather API call failed",
      "externalWeatherService",
      { error: err instanceof Error ? err.message : String(err) },
    );
    return null;
  }
}

function normalizeWeatherResponse(raw: unknown): HourlyWeatherSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const temperatureC =
    typeof obj.temperatureC === "number" ? obj.temperatureC :
    typeof obj.temperature === "number" ? obj.temperature : null;

  const feelsLikeC =
    typeof obj.feelsLikeC === "number" ? obj.feelsLikeC :
    typeof obj.feelsLike === "number" ? obj.feelsLike : null;

  const humidityPct =
    typeof obj.humidityPct === "number" ? obj.humidityPct :
    typeof obj.humidity === "number" ? obj.humidity : null;

  if (temperatureC === null || feelsLikeC === null || humidityPct === null) {
    return null;
  }
  return { temperatureC, feelsLikeC, humidityPct };
}
