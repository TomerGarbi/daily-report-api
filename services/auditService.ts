/**
 * auditService.ts
 *
 * Fluent recorder for user-initiated actions. Writes to the `audit_events`
 * collection out-of-band so a slow / failing write NEVER blocks the request
 * that produced the event — same philosophy as `loggerService.writeToDatabase`.
 *
 * Usage inside a controller:
 *
 *   await audit.recordSuccess({
 *     req,
 *     action: "report.publish",
 *     resource: { type: "report", id: report._id.toString(), label: report.title },
 *     before, after,
 *   });
 *
 *   audit.recordFailure({
 *     req, action: "user.delete",
 *     resource: { type: "user", id: userId, label: target.username },
 *     reason: "user attempted to delete themselves",
 *   });
 *
 * Actions follow a `noun.verb[.qualifier]` convention:
 *   report.create / report.update / report.publish / report.delete
 *   user.role.change / user.groups.change / user.disable / user.delete
 *   station.create / station.update / fuelSite.delete
 *   auth.login / auth.logout / auth.refresh / auth.permission.denied
 */

import type { Request } from "express";
import { AuditEvent } from "../models/AuditEvent";
import { logger } from "./loggerService";

interface AuditResource {
  type: string;
  id?: string;
  label?: string;
}

interface AuditRecordArgs {
  /** The Express request — used to pull actor / requestId / ip / user-agent. */
  req: Request;
  /** Machine-readable action key. See file header for the convention. */
  action: string;
  /** The resource being acted on. */
  resource: AuditResource;
  /** Optional snapshot of the resource before the change. */
  before?: Record<string, unknown>;
  /** Optional snapshot of the resource after the change. */
  after?: Record<string, unknown>;
  /** Free-form metadata — diff summary, reason on failure, etc. */
  meta?: Record<string, unknown>;
}

interface AuditFailureArgs extends AuditRecordArgs {
  /** Human-readable reason the action failed. Copied into meta.reason. */
  reason: string;
}

/**
 * Explicit `undefined` for optional fields would break Mongoose's
 * `strictQuery`, so we build the payload conditionally.
 */
function buildPayload(
  args: AuditRecordArgs,
  outcome: "success" | "failure",
): Record<string, unknown> {
  const actor = args.req.user?.username ?? "anonymous";
  const payload: Record<string, unknown> = {
    timestamp: new Date(),
    actor,
    action: args.action,
    resourceType: args.resource.type,
    outcome,
  };

  if (args.resource.id)    payload["resourceId"]    = args.resource.id;
  if (args.resource.label) payload["resourceLabel"] = args.resource.label;
  if (args.req.id)         payload["requestId"]     = args.req.id;
  if (args.req.ip)         payload["ip"]            = args.req.ip;

  const ua = args.req.headers["user-agent"];
  if (typeof ua === "string" && ua.length > 0) payload["userAgent"] = ua.slice(0, 500);

  if (args.before) payload["before"] = args.before;
  if (args.after)  payload["after"]  = args.after;
  if (args.meta)   payload["meta"]   = args.meta;

  return payload;
}

/**
 * Fire-and-forget write. A failed audit persistence is logged at `warn` (not
 * `error`, so it doesn't itself trigger error-reporter alerting) and does NOT
 * throw — controllers must never see an audit-write failure.
 */
function persist(payload: Record<string, unknown>): void {
  AuditEvent.create(payload).catch((err) => {
    logger.warn("AuditEvent persistence failed", "AuditService", {
      action: payload["action"],
      actor: payload["actor"],
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

export const audit = {
  recordSuccess(args: AuditRecordArgs): void {
    persist(buildPayload(args, "success"));
  },
  recordFailure(args: AuditFailureArgs): void {
    const payload = buildPayload(args, "failure");
    payload["meta"] = { ...(args.meta ?? {}), reason: args.reason };
    persist(payload);
  },
};

export type AuditRecorder = typeof audit;
