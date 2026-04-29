import { z } from "zod";

// ─── Query: GET /weather/forecast ─────────────────────────────────────────────

export const weatherForecastQuerySchema = z.object({
  region: z.string().trim().min(1).max(50).optional().default("gush-dan"),
});

export type WeatherForecastQuery = z.infer<typeof weatherForecastQuerySchema>;
