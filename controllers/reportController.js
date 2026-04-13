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
 * Admins/managers see global stats.
 * Regular users see only their own stats.
 *
 * Response 200:
 * {
 *   total,
 *   byStatus: { draft, published },
 *   byGroup:  [{ group, count }],
 *   mine:     { total, draft, published },
 *   recent:   { last7Days, last30Days }
 * }
 */
const statsReportHandler = async (req, res) => {
    const actor = req.user;
    const isManagerOrAbove = actor.role === "manager" || actor.role === "admin";
    const now = new Date();
    const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const userId = await User_1.User.findOne({ username: actor.username }).select("_id").lean();
    const [globalAgg, mineAgg, recentAgg] = await Promise.all([
        // Total + breakdown by status (global or scoped to user)
        Report_1.Report.aggregate([
            ...(isManagerOrAbove ? [] : [{ $match: { "createdBy.username": actor.username } }]),
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                },
            },
        ]),
        // Current user's own counts
        Report_1.Report.aggregate([
            { $match: { "createdBy.username": actor.username } },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                },
            },
        ]),
        // Reports created in the last 7 and 30 days
        Report_1.Report.aggregate([
            ...(isManagerOrAbove ? [] : [{ $match: { "createdBy.username": actor.username } }]),
            {
                $group: {
                    _id: null,
                    last7Days: { $sum: { $cond: [{ $gte: ["$createdAt", last7] }, 1, 0] } },
                    last30Days: { $sum: { $cond: [{ $gte: ["$createdAt", last30] }, 1, 0] } },
                },
            },
        ]),
    ]);
    // Shape the status aggregation into { draft: n, published: n }
    const toStatusMap = (agg) => agg.reduce((acc, row) => { acc[row._id] = row.count; return acc; }, { draft: 0, published: 0 });
    const byStatus = toStatusMap(globalAgg);
    const mineByStatus = toStatusMap(mineAgg);
    res.status(200).json({
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
    });
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