import { Request, Response } from "express";
import { Log } from "../models/Log";
import { NotFoundError } from "../errors/AppError";
import type { ListLogsQuery } from "../schemas/logSchemas";

// ─── GET /logs ────────────────────────────────────────────────────────────────

/**
 * List logs with optional filtering and pagination.
 * Query: ListLogsQuery
 *
 * Response 200: { data: ILog[], total, page, limit, totalPages, hasNextPage }
 */
export const listLogsHandler = async (req: Request, res: Response): Promise<void> => {
  const { level, user, context, search, from, to, page, limit } = req.query as unknown as ListLogsQuery;

  const filter: Record<string, unknown> = {};
  if (level)   filter["level"]   = level;
  if (user)    filter["user"]    = { $regex: user, $options: "i" };
  if (context) filter["context"] = { $regex: context, $options: "i" };
  if (search)  filter["message"] = { $regex: search, $options: "i" };

  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter["$gte"] = new Date(from);
    if (to)   dateFilter["$lte"] = new Date(to);
    filter["timestamp"] = dateFilter;
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Log.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Log.countDocuments(filter),
  ]);

  const totalPages  = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;

  res.status(200).json({ data, total, page, limit, totalPages, hasNextPage });
};

// ─── GET /logs/stats ──────────────────────────────────────────────────────────

/**
 * Returns aggregate statistics about logs.
 *
 * Response 200:
 * {
 *   total,
 *   byLevel:  { info, warn, error, debug },
 *   recent:   { last24Hours, last7Days },
 *   topContexts: [{ context, count }]
 * }
 */
export const statsLogsHandler = async (_req: Request, res: Response): Promise<void> => {
  const now      = new Date();
  const last24h  = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d   = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);

  const [byLevelAgg, recentAgg, topContextsAgg] = await Promise.all([
    Log.aggregate([
      { $group: { _id: "$level", count: { $sum: 1 } } },
    ]),

    Log.aggregate([
      { $match: { timestamp: { $gte: last7d } } },
      {
        $group: {
          _id: null,
          last24Hours: { $sum: { $cond: [{ $gte: ["$timestamp", last24h] }, 1, 0] } },
          last7Days:   { $sum: 1 },
        },
      },
    ]),

    Log.aggregate([
      { $match: { context: { $exists: true, $ne: null } } },
      { $group: { _id: "$context", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, context: "$_id", count: 1 } },
    ]),
  ]);

  const byLevel = byLevelAgg.reduce<Record<string, number>>(
    (acc, row) => { acc[row._id] = row.count; return acc; },
    { info: 0, warn: 0, error: 0, debug: 0 },
  );

  res.status(200).json({
    total: Object.values(byLevel).reduce((a, b) => a + b, 0),
    byLevel,
    recent: {
      last24Hours: recentAgg[0]?.last24Hours ?? 0,
      last7Days:   recentAgg[0]?.last7Days   ?? 0,
    },
    topContexts: topContextsAgg,
  });
};

// ─── GET /logs/:id ────────────────────────────────────────────────────────────

/**
 * Get a single log entry by its MongoDB ObjectId.
 *
 * Response 200: log document
 * Response 404: not found
 */
export const getLogHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const log = await Log.findById(id).lean();

  if (!log) {
    throw new NotFoundError(`Log ${id} not found`, "LogController");
  }

  res.status(200).json(log);
};
