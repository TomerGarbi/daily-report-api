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

/** One fuel a unit can run on, plus the peak MW it produces on that fuel. */
export interface IFuelCapacity {
  /** Fuel / technology (constrained enum, shared with reports). */
  type: StationFuel;
  /** Peak nameplate capacity when running on this fuel, in MW @ 15°C. */
  capacity: number;
}

export interface IUnit {
  /** Mongoose-managed sub-doc id; surfaced to clients as `id`. */
  _id: Types.ObjectId;

  /**
   * Human-friendly unit number (e.g. `1`, `2`, `3`). User-supplied at
   * station-creation time. Serves as the unit's display name in reports.
   * Must be unique within the parent station.
   */
  number: number;

  /**
   * Primary fuel this unit runs on and its peak capacity on that fuel.
   * The station's overall main fuel is derived by aggregating this field
   * across all units (see `getStationMainFuel` on the frontend).
   */
  mainFuel: IFuelCapacity;

  /**
   * Backup fuels the unit can switch to, each with its own peak capacity.
   * Fuels here are alternatives to `mainFuel` — capacities are NOT added
   * to the total; they represent peak MW when the unit runs on that fuel.
   */
  secondaryFuels: IFuelCapacity[];
}

export interface IStation extends Document {
  /** Human-readable display name. */
  name: string;

  /** Short identifier used in headers / dropdowns. */
  tag: string;

  /** Ownership type (IEC vs. private independent producer). */
  type: StationType;

  /**
   * Embedded list of physical units owned by this station. The station's
   * primary fuel is derived from these units and no longer stored.
   */
  units: Types.DocumentArray<IUnit>;

  // Mongoose-managed timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const FuelCapacitySchema = new Schema<IFuelCapacity>(
  {
    type: {
      type: String,
      required: true,
      enum: STATION_FUELS,
    },
    capacity: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const UnitSchema = new Schema<IUnit>(
  {
    number: {
      type: Number,
      required: true,
      min: 1,
    },
    mainFuel: {
      type: FuelCapacitySchema,
      required: true,
    },
    secondaryFuels: {
      type: [FuelCapacitySchema],
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
// Support filtering stations by any unit's main fuel type.
StationSchema.index({ "units.mainFuel.type": 1, name: 1 });

// Unit numbers must be unique within a single station (not globally).
StationSchema.index(
  { _id: 1, "units.number": 1 },
  { unique: true, sparse: true }
);

// ─── Model ────────────────────────────────────────────────────────────────────

export const Station = mongoose.model<IStation>("Station", StationSchema);
