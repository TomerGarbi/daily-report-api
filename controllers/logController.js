"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogHandler = exports.statsLogsHandler = exports.listLogsHandler = void 0;
const Log_1 = require("../models/Log");
// ─── GET /logs ────────────────────────────────────────────────────────────────
/**
 * List logs with optional filtering and pagination.
 * Query: ListLogsQuery
 *
 * Response 200: { data: ILog[], total, page, limit, totalPages, hasNextPage }
 */
const listLogsHandler = async (req, res) => {
    const { level, user, context, search, from, to, page, limit } = req.query;
    const filter = {};
    if (level)
        filter["level"] = level;
    if (user)
        filter["user"] = { $regex: user, $options: "i" };
    if (context)
        filter["context"] = { $regex: context, $options: "i" };
    if (search)
        filter["message"] = { $regex: search, $options: "i" };
    if (from || to) {
        const dateFilter = {};
        if (from)
            dateFilter["$gte"] = new Date(from);
        if (to)
            dateFilter["$lte"] = new Date(to);
        filter["timestamp"] = dateFilter;
    }
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
        Log_1.Log.find(filter)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Log_1.Log.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    res.status(200).json({ data, total, page, limit, totalPages, hasNextPage });
};
exports.listLogsHandler = listLogsHandler;
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
const statsLogsHandler = async (_req, res) => {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [byLevelAgg, recentAgg, topContextsAgg] = await Promise.all([
        Log_1.Log.aggregate([
            { $group: { _id: "$level", count: { $sum: 1 } } },
        ]),
        Log_1.Log.aggregate([
            { $match: { timestamp: { $gte: last7d } } },
            {
                $group: {
                    _id: null,
                    last24Hours: { $sum: { $cond: [{ $gte: ["$timestamp", last24h] }, 1, 0] } },
                    last7Days: { $sum: 1 },
                },
            },
        ]),
        Log_1.Log.aggregate([
            { $match: { context: { $exists: true, $ne: null } } },
            { $group: { _id: "$context", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { _id: 0, context: "$_id", count: 1 } },
        ]),
    ]);
    const byLevel = byLevelAgg.reduce((acc, row) => { acc[row._id] = row.count; return acc; }, { info: 0, warn: 0, error: 0, debug: 0 });
    res.status(200).json({
        total: Object.values(byLevel).reduce((a, b) => a + b, 0),
        byLevel,
        recent: {
            last24Hours: recentAgg[0]?.last24Hours ?? 0,
            last7Days: recentAgg[0]?.last7Days ?? 0,
        },
        topContexts: topContextsAgg,
    });
};
exports.statsLogsHandler = statsLogsHandler;
// ─── GET /logs/:id ────────────────────────────────────────────────────────────
/**
 * Get a single log entry by its MongoDB ObjectId.
 *
 * Response 200: log document
 * Response 404: not found
 */
const getLogHandler = async (req, res) => {
    const { id } = req.params;
    const log = await Log_1.Log.findById(id).lean();
    if (!log) {
        res.status(404).json({ message: `Log ${id} not found` });
        return;
    }
    res.status(200).json(log);
};
exports.getLogHandler = getLogHandler;
//# sourceMappingURL=logController.js.map