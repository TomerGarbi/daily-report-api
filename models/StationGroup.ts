import mongoose, { Schema, Document } from "mongoose";
import { STATION_TYPES, type StationType } from "./Station";

/**
 * A logical grouping of stations that decides how report tables are laid
 * out. Each group belongs to exactly one ownership type (`iec` or `private`)
 * and every station in the catalog must reference one group of its own
 * type.
 *
 * Report content is keyed by `group.tag` (stable, human-friendly) rather
 * than by fuel type — the old fuel-based layout has been replaced by a
 * group-based one.
 */
export interface IStationGroup extends Document {
  /** Human-readable display name (unique within the group's type). */
  name: string;

  /**
   * Short, URL-safe identifier used as the key on `report.content.<type>`.
   * Must be globally unique to keep report look-ups unambiguous.
   */
  tag: string;

  /** Ownership type the group belongs to. */
  type: StationType;

  /**
   * Optional integer used to sort groups within their type when rendering
   * report tables. Lower values render first. Defaults to 0.
   */
  order: number;

  /** Free-text description shown in the settings UI. */
  description?: string;

  createdAt: Date;
  updatedAt: Date;
}

const StationGroupSchema = new Schema<IStationGroup>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    tag: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: STATION_TYPES,
      index: true,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Uniqueness of `name` scoped per type (so "צפון" can exist under both iec
// and private without colliding).
StationGroupSchema.index({ type: 1, name: 1 }, { unique: true });
StationGroupSchema.index({ type: 1, order: 1, name: 1 });

export const StationGroup = mongoose.model<IStationGroup>(
  "StationGroup",
  StationGroupSchema,
);
