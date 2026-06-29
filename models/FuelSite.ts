import mongoose, { Schema, Document, Types } from "mongoose";
import { STATION_FUELS, type StationFuel } from "./Station";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ITank {
  _id: Types.ObjectId;
  /** Human-readable tank label (e.g. "T-1", "Tank A"). Unique within a site. */
  name: string;
  /** Which of the site's fuel types this tank holds. */
  fuelType: StationFuel;
  /** Optional maximum capacity (in the site's reporting unit, e.g. cubic meters). */
  capacity?: number;
}

export interface IFuelSite extends Document {
  /** Display name of the fuel site. */
  name: string;
  /** Short tag used in dropdowns / report rows (unique). */
  tag: string;
  /** All fuel types stored at this site. Each tank must use one of these. */
  fuelTypes: StationFuel[];
  /** Physical tanks at the site. */
  tanks: Types.DocumentArray<ITank>;

  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const TankSchema = new Schema<ITank>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    fuelType: {
      type: String,
      required: true,
      enum: STATION_FUELS,
    },
    capacity: {
      type: Number,
      min: 0,
    },
  },
  { _id: true }
);

const FuelSiteSchema = new Schema<IFuelSite>(
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
    fuelTypes: {
      type: [{ type: String, enum: STATION_FUELS }],
      required: true,
      default: [],
    },
    tanks: {
      type: [TankSchema],
      required: true,
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Tank names must be unique within a single fuel site (not globally).
FuelSiteSchema.index(
  { _id: 1, "tanks.name": 1 },
  { unique: true, sparse: true }
);

export const FuelSite = mongoose.model<IFuelSite>("FuelSite", FuelSiteSchema);
