import mongoose, { Schema, Document } from "mongoose";
import { getAuditRetentionDays } from "../config/appConfig";

/**
 * AuditEvent — first-class record of a user-initiated action.
 *
 * This is deliberately SEPARATE from the `logs` collection:
 *   • `logs` is Winston-driven and mixes system + error events; TTL is short
 *     (30 days) because debug noise doesn't age well.
 *   • `audit_events` is written explicitly by controllers via `auditService`
 *     to record WHO did WHAT to WHICH resource. Retention is longer
 *     (default 365 days) because "did user X publish report Y?" is a
 *     compliance-grade question.
 *
 * Fields chosen so the admin UI can render both a global feed and a
 * per-user / per-resource timeline without joining collections.
 */
export interface IAuditEvent extends Document {
  timestamp: Date;
  /** username of the actor (matches `User.username`; kept as string so
   *  purged users still appear in old audit trails). */
  actor: string;
  /** Machine-readable action key — e.g. "report.publish", "user.role.change". */
  action: string;
  /** Category of the affected resource — "report" | "user" | "station" | ... */
  resourceType: string;
  /** Human-friendly label — the report title, the target username, etc. */
  resourceLabel?: string;
  /** Stable identifier of the affected resource (usually its ObjectId). */
  resourceId?: string;
  /** Correlated request id from `X-Request-Id`. */
  requestId?: string;
  /** IP address of the actor at the time of the action. */
  ip?: string;
  /** User-Agent header of the actor's client. */
  userAgent?: string;
  /** Outcome — "success" or "failure". Failures include the reason in meta. */
  outcome: "success" | "failure";
  /** Optional snapshot of the resource before + after the change. */
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  /** Free-form structured metadata — reason on failure, diff summary, etc. */
  meta?: Record<string, unknown>;
}

const AuditEventSchema = new Schema<IAuditEvent>(
  {
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    actor: {
      type: String,
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    resourceType: {
      type: String,
      required: true,
      index: true,
    },
    resourceLabel: {
      type: String,
      required: false,
    },
    resourceId: {
      type: String,
      required: false,
      index: true, // enables per-resource timeline queries
    },
    requestId: {
      type: String,
      required: false,
      index: true, // correlate audit event ↔ log entries by requestId
    },
    ip: {
      type: String,
      required: false,
    },
    userAgent: {
      type: String,
      required: false,
    },
    outcome: {
      type: String,
      required: true,
      enum: ["success", "failure"],
      default: "success",
    },
    before: {
      type: Schema.Types.Mixed,
      required: false,
    },
    after: {
      type: Schema.Types.Mixed,
      required: false,
    },
    meta: {
      type: Schema.Types.Mixed,
      required: false,
    },
  },
  {
    timestamps: false,
    collection: "audit_events",
  },
);

// Composite index for the global "latest events" query.
AuditEventSchema.index({ timestamp: -1, actor: 1 });

// TTL index — configurable via AUDIT_RETENTION_DAYS. Note: changing the
// duration after the fact requires dropping and recreating this index.
AuditEventSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: getAuditRetentionDays() * 24 * 60 * 60 },
);

export const AuditEvent = mongoose.model<IAuditEvent>("AuditEvent", AuditEventSchema);
