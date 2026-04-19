"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteReportHandler = exports.updateReportHandler = exports.getReportHandler = exports.listReportsHandler = exports.createReportHandler = exports.statsReportHandler = void 0;
const Report_1 = require("../models/Report");
const User_1 = require("../models/User");
const AppError_1 = require("../errors/AppError");
const loggerService_1 = require("../services/loggerService");
// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Resolve the MongoDB _id for the currently authenticated user.
 * Throws BadRequestError when the user record doesn't exist yet.
 */
async function resolveUserId(username) {
    const user = await User_1.User.findOne({ username }).select("_id").lean();
    if (!user) {
        throw new AppError_1.BadRequestError(`User "${username}" not found in the database. Ensure the user has logged in at least once.`, "ReportController");
    }
    return user._id;
}
// ─── GET /reports/stats ──────────────────────────────────────────────────────
/**
 * Returns aggregate statistics about reports.
 *
 * - Admins / managers see **global** stats (all reports in the system).
 * - Regular users see only **their own** reports.
 *
 * Response 200:
 * ```json
 * {
 *   "total": 42,
 *   "byStatus": { "draft": 5, "published": 37 },
 *   "mine": {
 *     "total": 12,
 *     "draft": 2,
 *     "published": 10
 *   },
 *   "recent": {
 *     "last7Days": 4,
 *     "last30Days": 18
 *   },
 *   "dailyCounts": [
 *     { "date": "2026-03-15", "count": 2 },
 *     { "date": "2026-03-16", "count": 0 },
 *     ...
 *   ],
 *   "topAuthors": [
 *     { "username": "admin.dev", "count": 15 },
 *     { "username": "user.dev",  "count": 10 }
 *   ]
 * }
 * ```
 *
 * Notes:
 * - `dailyCounts` covers the last 30 days (inclusive of today), with zero-filled gaps.
 * - `topAuthors` is only present for managers / admins (top 10 by report count).
 */
const statsReportHandler = async (req, res) => {
    const actor = req.user;
    const isManagerOrAbove = actor.role === "manager" || actor.role === "admin";
    const now = new Date();
    const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    // Scope filter: managers+ see everything, others see only their own reports.
    const scopeMatch = isManagerOrAbove
        ? {}
        : { "createdBy.username": actor.username };
    const [statusAgg, mineAgg, recentAgg, dailyAgg, topAuthorsAgg,] = await Promise.all([
        // 1. Total + breakdown by status (scoped)
        Report_1.Report.aggregate([
            { $match: scopeMatch },
            { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        // 2. Current user's own counts (always scoped to actor)
        Report_1.Report.aggregate([
            { $match: { "createdBy.username": actor.username } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        // 3. Reports created in the last 7 / 30 days (scoped)
        Report_1.Report.aggregate([
            { $match: { ...scopeMatch, createdAt: { $gte: last30 } } },
            {
                $group: {
                    _id: null,
                    last7Days: { $sum: { $cond: [{ $gte: ["$createdAt", last7] }, 1, 0] } },
                    last30Days: { $sum: 1 },
                },
            },
        ]),
        // 4. Daily counts for the last 30 days (scoped) — for charts
        Report_1.Report.aggregate([
            { $match: { ...scopeMatch, createdAt: { $gte: last30 } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]),
        // 5. Top authors (managers+ only — top 10)
        isManagerOrAbove
            ? Report_1.Report.aggregate([
                {
                    $group: {
                        _id: "$createdBy.username",
                        count: { $sum: 1 },
                    },
                },
                { $sort: { count: -1 } },
                { $limit: 10 },
                { $project: { _id: 0, username: "$_id", count: 1 } },
            ])
            : Promise.resolve([]),
    ]);
    // ── Shape helpers ──────────────────────────────────────────────────────────
    const toStatusMap = (agg) => agg.reduce((acc, row) => { acc[row._id] = row.count; return acc; }, { draft: 0, published: 0 });
    // Zero-fill daily counts so the frontend always has 30 entries.
    const dailyMap = new Map(dailyAgg.map((d) => [d._id, d.count]));
    const dailyCounts = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        dailyCounts.push({ date: key, count: dailyMap.get(key) ?? 0 });
    }
    const byStatus = toStatusMap(statusAgg);
    const mineByStatus = toStatusMap(mineAgg);
    const body = {
        total: byStatus.draft + byStatus.published,
        byStatus,
        mine: {
            total: mineByStatus.draft + mineByStatus.published,
            draft: mineByStatus.draft,
            published: mineByStatus.published,
        },
        recent: {
            last7Days: recentAgg[0]?.last7Days ?? 0,
            last30Days: recentAgg[0]?.last30Days ?? 0,
        },
        dailyCounts,
    };
    if (isManagerOrAbove) {
        body["topAuthors"] = topAuthorsAgg;
    }
    res.status(200).json(body);
};
exports.statsReportHandler = statsReportHandler;
// ─── POST /reports ────────────────────────────────────────────────────────────
/**
 * Create a new report.
 * Body: CreateReportInput
 *
 * Response 201: created report document
 * Response 400: validation error or user not found
 */
const createReportHandler = async (req, res) => {
    const { title, description, content, status } = req.body;
    const actor = req.user;
    const userId = await resolveUserId(actor.username);
    const report = await Report_1.Report.create({
        title,
        description,
        content,
        status,
        createdBy: { username: actor.username, userId },
        updatedBy: { username: actor.username, userId },
    });
    loggerService_1.logger.info("Report created", "ReportController", {
        reportId: report._id,
        username: actor.username,
    });
    res.status(201).json(report);
};
exports.createReportHandler = createReportHandler;
// ─── GET /reports ─────────────────────────────────────────────────────────────
/**
 * List reports with optional filtering and pagination.
 * Query: ListReportsQuery
 *
 * Response 200: { data: IReport[], total, page, limit }
 */
const listReportsHandler = async (req, res) => {
    const { status, search, author, createdAfter, createdBefore, page, limit } = req.query;
    const filter = {};
    if (status)
        filter["status"] = status;
    if (search)
        filter["title"] = { $regex: search, $options: "i" };
    if (author)
        filter["createdBy.username"] = { $regex: author, $options: "i" };
    // Date-range filter on createdAt
    if (createdAfter || createdBefore) {
        const dateFilter = {};
        if (createdAfter)
            dateFilter["$gte"] = new Date(createdAfter);
        if (createdBefore)
            dateFilter["$lte"] = new Date(createdBefore);
        filter["createdAt"] = dateFilter;
    }
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
        Report_1.Report.find(filter)
            .select("-content")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Report_1.Report.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    res.status(200).json({ data, total, page, limit, totalPages, hasNextPage });
};
exports.listReportsHandler = listReportsHandler;
// ─── GET /reports/:id ─────────────────────────────────────────────────────────
/**
 * Get a single report by its MongoDB ObjectId.
 *
 * Response 200: report document (group populated)
 * Response 404: not found
 */
const getReportHandler = async (req, res) => {
    const { id } = req.params;
    const report = await Report_1.Report.findById(id).lean();
    if (!report) {
        throw new AppError_1.NotFoundError(`Report ${id} not found`, "ReportController");
    }
    res.status(200).json(report);
};
exports.getReportHandler = getReportHandler;
// ─── PATCH /reports/:id ───────────────────────────────────────────────────────
/**
 * Update a report.
 * - Owners (createdBy) may update any field.
 * - Managers and admins may update any report.
 * - Other users receive 403.
 *
 * Body: UpdateReportInput
 *
 * Response 200: updated report document
 * Response 403: not the owner and not manager+
 * Response 404: not found
 */
const updateReportHandler = async (req, res) => {
    const { id } = req.params;
    const actor = req.user;
    const updates = req.body;
    const report = await Report_1.Report.findById(id);
    if (!report) {
        throw new AppError_1.NotFoundError(`Report ${id} not found`, "ReportController");
    }
    const isOwner = report.createdBy.username === actor.username;
    const isManager = actor.role === "manager" || actor.role === "admin";
    if (!isOwner && !isManager) {
        throw new AppError_1.ForbiddenError("You do not have permission to update this report", "ReportController");
    }
    const userId = await resolveUserId(actor.username);
    const updated = await Report_1.Report.findByIdAndUpdate(id, {
        ...updates,
        updatedBy: { username: actor.username, userId },
    }, { new: true, runValidators: true });
    loggerService_1.logger.info("Report updated", "ReportController", {
        reportId: id,
        username: actor.username,
        fields: Object.keys(updates),
    });
    res.status(200).json(updated);
};
exports.updateReportHandler = updateReportHandler;
// ─── DELETE /reports/:id ──────────────────────────────────────────────────────
/**
 * Delete a report.
 * Restricted to admins and the Reports-Admin group (enforced by route policy).
 *
 * Response 200: { message }
 * Response 404: not found
 */
const deleteReportHandler = async (req, res) => {
    const { id } = req.params;
    const report = await Report_1.Report.findByIdAndDelete(id);
    if (!report) {
        throw new AppError_1.NotFoundError(`Report ${id} not found`, "ReportController");
    }
    loggerService_1.logger.info("Report deleted", "ReportController", {
        reportId: id,
        username: req.user.username,
    });
    res.status(204).end();
};
exports.deleteReportHandler = deleteReportHandler;
//# sourceMappingURL=reportController.js.map