import mongoose, { Schema, Document } from "mongoose";

export interface ILog extends Document {
  timestamp: Date;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  user: string;
  context?: string;
  meta?: Record<string, any>;
}

const LogSchema: Schema = new Schema(
  {
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    level: {
      type: String,
      required: true,
      enum: ["info", "warn", "error", "debug"],
      index: true,
    },
    message: {
      type: String,
      required: true,
    },
    user: {
      type: String,
      required: true,
      default: "system",
      index: true,
    },
    context: {
      type: String,
      required: false,
    },
    meta: {
      type: Schema.Types.Mixed,
      required: false,
    },
  },
  {
    timestamps: false, // We're using our own timestamp field
    collection: "logs",
  }
);

// Index for efficient querying by timestamp and level
LogSchema.index({ timestamp: -1, level: 1 });

// TTL index — Mongo will evict log documents older than LOG_RETENTION_DAYS.
// Note: changing the retention duration requires dropping and recreating the
// index in Mongo (TTL `expireAfterSeconds` cannot be modified in place via
// schema changes alone).
import { getLogRetentionDays } from "../config/appConfig";
LogSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: getLogRetentionDays() * 24 * 60 * 60 }
);

export const Log = mongoose.model<ILog>("Log", LogSchema);
