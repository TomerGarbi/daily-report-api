import { Request, Response } from "express";
import { AuditEvent } from "../models/AuditEvent";
import type { ListAuditQuery } from "../schemas/auditSchemas";

/**
 * List audit events with optional filtering and pagination.
 *
 * Query params (all optional):
 *   actor         — exact username match (case-insensitive)
 *   action        — exact action key match (e.g. "report.publish")
 *   resourceType  — filter by resource category
 *   resourceId    — filter by specific resource
 *   outcome       — "success" | "failure"
 *   from, to      — ISO date range on `timestamp`
 *   requestId     — correlate with a specific request
 *   page, limit
 *
 * Response 200: { data: IAuditEvent[], total, page, limit, totalPages, hasNextPage }
 */
export const listAuditHandler = async (req: Request, res: Response): Promise<void> => {
  const {
    actor, action, resourceType, resourceId, outcome, from, to, requestId, page, limit,
  } = req.query as unknown as ListAuditQuery;

  const filter: Record<string, unknown> = {};
  if (actor)        filter["actor"]        = { $regex: `^${actor}$`, $options: "i" };
  if (action)       filter["action"]       = action;
  if (resourceType) filter["resourceType"] = resourceType;
  if (resourceId)   filter["resourceId"]   = resourceId;
  if (outcome)      filter["outcome"]      = outcome;
  if (requestId)    filter["requestId"]    = requestId;

  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range["$gte"] = new Date(from);
    if (to)   range["$lte"] = new Date(to);
    filter["timestamp"] = range;
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    AuditEvent.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditEvent.countDocuments(filter),
  ]);

  const totalPages  = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;

  res.status(200).json({ data, total, page, limit, totalPages, hasNextPage });
};

/**
 * GET /audit/stats
 * Aggregate counts for the last 24 h and 7 d, broken down by action and by
 * actor. Feeds the admin "activity insights" panel.
 */
export const statsAuditHandler = async (_req: Request, res: Response): Promise<void> => {
  const now     = new Date();
  const last24  = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);

  const [totalsAgg, topActionsAgg, topActorsAgg] = await Promise.all([
    AuditEvent.aggregate([
      { $match: { timestamp: { $gte: last7d } } },
      {
        $group: {
          _id: null,
          last24h:  { $sum: { $cond: [{ $gte: ["$timestamp", last24] }, 1, 0] } },
          last7d:   { $sum: 1 },
          failures: {
            $sum: {
              $cond: [{ $eq: ["$outcome", "failure"] }, 1, 0],
            },
          },
        },
      },
    ]),

    AuditEvent.aggregate([
      { $match: { timestamp: { $gte: last7d } } },
      { $group: { _id: "$action", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, action: "$_id", count: 1 } },
    ]),

    AuditEvent.aggregate([
      { $match: { timestamp: { $gte: last7d } } },
      { $group: { _id: "$actor", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, actor: "$_id", count: 1 } },
    ]),
  ]);

  res.status(200).json({
    last24h:  totalsAgg[0]?.last24h  ?? 0,
    last7d:   totalsAgg[0]?.last7d   ?? 0,
    failures: totalsAgg[0]?.failures ?? 0,
    topActions: topActionsAgg,
    topActors:  topActorsAgg,
  });
};

/**
 * GET /audit/user/:username/timeline
 * Fast per-user activity timeline for the user-detail drawer.
 *
 * Query params:
 *   limit — how many events to return (default 100, max 500).
 */
export const userTimelineHandler = async (req: Request, res: Response): Promise<void> => {
  const { username } = req.params;
  const limit = Math.min(500, Math.max(1, parseInt(String(req.query["limit"] ?? "100"), 10) || 100));

  const events = await AuditEvent.find({ actor: { $regex: `^${username}$`, $options: "i" } })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();

  res.status(200).json({ data: events, total: events.length });
};
