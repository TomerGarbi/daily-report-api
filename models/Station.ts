import mongoose, { Schema, Document, Types } from "mongoose";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Ownership type of the station. */
export type StationType = "iec" | "private";

export const STATION_TYPES: StationType[] = ["iec", "private"];

/** Primary generation fuel / technology of the station. */
export type StationFuel =
  | "gas"
  | "diesel"
  | "solar"
  | "turbine"
  | "coal"
  | "hydro"
  | "wind"
  | "nuclear"
  | "mazut"
  | "methanol"
  | "other";

export const STATION_FUELS: StationFuel[] = [
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
];

/**
 * Fuels are free-text on purpose — sites differ enough that a hard-coded
 * enum here would force a code change every time a new fuel type appears.
 * Validation lives in the Zod schema (length / sanitization), not here.
 */
export interface IUnit {
  /** Mongoose-managed sub-doc id; surfaced to clients as `id`. */
  _id: Types.ObjectId;

  /** Short tag shown in tables (e.g. "U-1", "GT-3"). */
  tag: string;

  /** Installed nameplate capacity in MW @ 15°C — a default for reports. */
  installedCapacity: number;

  /** Primary fuel (free text, e.g. "Natural Gas", "Diesel"). */
  mainFuel: string;

  /** Optional secondary / backup fuels. */
  secondaryFuels: string[];
}

export interface IStation extends Document {
  /** Human-readable display name. */
  name: string;

  /** Short identifier used in headers / dropdowns. */
  tag: string;

  /** Ownership type (IEC vs. private independent producer). */
  type: StationType;

  /** Primary generation fuel / technology. */
  fuel: StationFuel;

  /** Embedded list of physical units owned by this station. */
  units: Types.DocumentArray<IUnit>;

  // Mongoose-managed timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const UnitSchema = new Schema<IUnit>(
  {
    tag: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    installedCapacity: {
      type: Number,
      required: true,
      min: 0,
    },
    mainFuel: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    secondaryFuels: {
      type: [{ type: String, trim: true, maxlength: 100 }],
      required: true,
      default: [],
    },
  },
  // Keep the auto-generated `_id` so units are addressable individually.
  { _id: true }
);

const StationSchema = new Schema<IStation>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      index: true,
    },
    tag: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: STATION_TYPES,
      index: true,
    },
    fuel: {
      type: String,
      required: true,
      enum: STATION_FUELS,
      index: true,
    },
    units: {
      type: [UnitSchema],
      required: true,
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Fast look-ups
StationSchema.index({ type: 1, name: 1 });
StationSchema.index({ fuel: 1, name: 1 });

// Unit tags must be unique within a single station (not globally).
StationSchema.index(
  { _id: 1, "units.tag": 1 },
  { unique: true, sparse: true }
);

// ─── Model ────────────────────────────────────────────────────────────────────

export const Station = mongoose.model<IStation>("Station", StationSchema);
