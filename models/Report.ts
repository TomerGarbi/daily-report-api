import mongoose, { Schema, Document, Types } from "mongoose";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReportStatus = "draft" | "published";

/**
 * Minimal reference stored inline on the document.
 * Avoids a second DB round-trip for the most common read pattern.
 */
export interface IUserRef {
  /** sAMAccountName / application username */
  username: string;
  /** MongoDB ObjectId of the user document (when a users collection exists) */
  userId: Types.ObjectId;
}

// ─── Document interface ───────────────────────────────────────────────────────

export interface IReport extends Document {
  /** Short display name for the report. */
  title: string;

  /** One-paragraph summary shown in list views. */
  description: string;

  /** Full report payload — structure TBD. */
  content: Record<string, unknown>;

  /** Lifecycle stage of the report. */
  status: ReportStatus;

  /** Monotonically increasing integer; starts at 1, bumped on every save. */
  version: number;

  /** Who created the report. */
  createdBy: IUserRef;

  /** Who last saved the report (same as createdBy on first save). */
  updatedBy: IUserRef;

  // Mongoose auto-manages these via { timestamps: true }:
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const UserRefSchema = new Schema<IUserRef>(
  {
    username: { type: String, required: true },
    userId:   { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false } // embedded sub-doc, no separate _id needed
);

const ReportSchema = new Schema<IReport>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    content: {
      type: Schema.Types.Mixed,
      default: {},
    },

    status: {
      type: String,
      required: true,
      enum: ["draft", "published"] satisfies ReportStatus[],
      default: "draft",
      index: true,
    },

    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },

    createdBy: {
      type: UserRefSchema,
      required: true,
    },

    updatedBy: {
      type: UserRefSchema,
      required: true,
    },
  },
  {
    timestamps: true, // auto-manages createdAt / updatedAt
    versionKey: false,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Fast look-up by creator — "show me all reports I created"
ReportSchema.index({ "createdBy.userId": 1 });

// List view: sort by newest first within a status bucket
ReportSchema.index({ status: 1, createdAt: -1 });

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Bump the version counter on every update so callers can detect
 * concurrent-edit conflicts without pulling the full document.
 *
 * Hooks are registered for all common update paths so the counter
 * stays consistent regardless of which Mongoose method is used.
 */
ReportSchema.pre("findOneAndUpdate", function () {
  this.set({ $inc: { version: 1 } });
});

ReportSchema.pre("updateOne", function () {
  this.set({ $inc: { version: 1 } });
});

ReportSchema.pre("updateMany", function () {
  this.set({ $inc: { version: 1 } });
});

ReportSchema.pre("save", function () {
  if (!this.isNew) {
    this.version = (this.version ?? 0) + 1;
  }
});

// ─── Model ────────────────────────────────────────────────────────────────────

export const Report = mongoose.model<IReport>("Report", ReportSchema);
