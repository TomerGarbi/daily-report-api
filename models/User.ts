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

  // ── Activity tracking (populated by the login/refresh flow and the
  //    `trackActivity` middleware). All optional — legacy documents that
  //    predate these fields simply appear as "never logged in" until the
  //    user next authenticates.
  /** Timestamp of the most recent successful login. */
  lastLoginAt?: Date;
  /** IP address recorded at the most recent successful login. */
  lastLoginIp?: string;
  /** Timestamp of the most recent authenticated request. Throttled writer. */
  lastActivityAt?: Date;
  /** Total number of successful logins. Monotonically increasing. */
  loginCount: number;
  /** Failed login attempts since the last successful login. Reset on success. */
  failedLoginCount: number;
  /** If true, the user is soft-disabled — login is rejected without deletion. */
  disabled?: boolean;

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

    // ── Activity fields ────────────────────────────────────────────────────
    lastLoginAt: {
      type: Date,
      required: false,
      index: true, // used by dormant-user queries and stats aggregations
    },
    lastLoginIp: {
      type: String,
      required: false,
    },
    lastActivityAt: {
      type: Date,
      required: false,
      index: true, // used by "active now" filters + presence-dot queries
    },
    loginCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    failedLoginCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    disabled: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ─── Model ────────────────────────────────────────────────────────────────────

export const User = mongoose.model<IUser>("User", UserSchema);
