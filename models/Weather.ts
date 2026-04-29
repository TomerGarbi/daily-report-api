import mongoose, { Schema, Document } from "mongoose";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Region identifier. Free-form string for forward compatibility (currently
 *  only `gush-dan` is used by the UI). */
export type WeatherRegion = string;

export interface IWeather extends Document {
  /** Region key (e.g. `gush-dan`). */
  region: WeatherRegion;
  /** UTC midnight of the day this snapshot describes. */
  date: Date;
  /** Temperature in Celsius. */
  temperatureC: number;
  /** "Feels like" temperature in Celsius. */
  feelsLikeC: number;
  /** Relative humidity, 0–100. */
  humidityPct: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const WeatherSchema = new Schema<IWeather>(
  {
    region: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    temperatureC: {
      type: Number,
      required: true,
      min: -50,
      max: 60,
    },
    feelsLikeC: {
      type: Number,
      required: true,
      min: -50,
      max: 60,
    },
    humidityPct: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Exactly one snapshot per (region, day).
WeatherSchema.index({ region: 1, date: 1 }, { unique: true });

// ─── Model ────────────────────────────────────────────────────────────────────

export const Weather = mongoose.model<IWeather>("Weather", WeatherSchema);
