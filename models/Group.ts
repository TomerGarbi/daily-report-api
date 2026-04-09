import mongoose, { Schema, Document } from "mongoose";

// ─── Document interface ───────────────────────────────────────────────────────

export interface IGroup extends Document {
  /** Human-readable group name (e.g. "IT-Admins", "Finance"). */
  name: string;

  /** Timestamps managed by Mongoose. */
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const GroupSchema = new Schema<IGroup>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ─── Model ────────────────────────────────────────────────────────────────────

export const Group = mongoose.model<IGroup>("Group", GroupSchema);
