import mongoose, { Schema, Document, Types } from "mongoose";
import { ROLE_HIERARCHY, Role } from "../types/auth";

// ─── Document interface ───────────────────────────────────────────────────────

export interface IUser extends Document {
  /** Unique login name — sAMAccountName in AD, or the chosen handle in dev. */
  username: string;

  /**
   * Groups this user belongs to — stored as ObjectId refs to the Group collection.
   * Mirrors the AD group memberships populated at login time.
   */
  groups: Types.ObjectId[];

  /** Resolved application role (derived from groups at login, cached here). */
  role: Role;

  /** Timestamps managed by Mongoose. */
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    groups: {
      type: [{ type: Schema.Types.ObjectId, ref: "Group" }],
      required: true,
      default: [],
    },

    role: {
      type: String,
      required: true,
      enum: ROLE_HIERARCHY as unknown as Role[],
      default: "guest" satisfies Role,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ─── Model ────────────────────────────────────────────────────────────────────

export const User = mongoose.model<IUser>("User", UserSchema);
