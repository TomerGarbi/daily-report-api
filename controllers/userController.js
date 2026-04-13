"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserHandler = exports.updateUserHandler = exports.getUserHandler = exports.listUsersHandler = exports.statsUserHandler = void 0;
const mongoose_1 = require("mongoose");
const User_1 = require("../models/User");
const Group_1 = require("../models/Group");
const AppError_1 = require("../errors/AppError");
const loggerService_1 = require("../services/loggerService");
// ─── GET /users/stats ───────────────────────────────────────────────────────
/**
 * Returns aggregate statistics about users in the system.
 *
 * Response 200:
 * {
 *   total,
 *   byRole:  { guest, user, manager, admin },
 *   byGroup: [{ group, groupId, count }],
 *   recent:  { last7Days, last30Days }
 * }
 */
const statsUserHandler = async (_req, res) => {
    const now = new Date();
    const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [byRoleAgg, byGroupAgg, recentAgg] = await Promise.all([
        // Count per role
        User_1.User.aggregate([
            { $group: { _id: "$role", count: { $sum: 1 } } },
        ]),
        // Count per group (users can belong to multiple groups — unwind first)
        User_1.User.aggregate([
            { $unwind: { path: "$groups", preserveNullAndEmptyArrays: false } },
            { $group: { _id: "$groups", count: { $sum: 1 } } },
            {
                $lookup: {
                    from: "groups",
                    localField: "_id",
                    foreignField: "_id",
                    as: "groupDoc",
                },
            },
            {
                $project: {
                    _id: 0,
                    groupId: "$_id",
                    group: { $arrayElemAt: ["$groupDoc.name", 0] },
                    count: 1,
                },
            },
            { $sort: { count: -1 } },
        ]),
        // Users created in the last 7 and 30 days
        User_1.User.aggregate([
            {
                $group: {
                    _id: null,
                    last7Days: { $sum: { $cond: [{ $gte: ["$createdAt", last7] }, 1, 0] } },
                    last30Days: { $sum: { $cond: [{ $gte: ["$createdAt", last30] }, 1, 0] } },
                },
            },
        ]),
    ]);
    // Shape role aggregation into { guest, user, manager, admin }
    const byRole = byRoleAgg.reduce((acc, row) => { acc[row._id] = row.count; return acc; }, { guest: 0, user: 0, manager: 0, admin: 0 });
    res.status(200).json({
        total: Object.values(byRole).reduce((s, n) => s + n, 0),
        byRole,
        byGroup: byGroupAgg,
        recent: {
            last7Days: recentAgg[0]?.last7Days ?? 0,
            last30Days: recentAgg[0]?.last30Days ?? 0,
        },
    });
};
exports.statsUserHandler = statsUserHandler;
// ─── GET /users ───────────────────────────────────────────────────────────────
/**
 * List users with optional filtering and pagination.
 *
 * Query params (all optional):
 *   role    — filter by exact role
 *   group   — filter by group ObjectId membership
 *   search  — partial, case-insensitive username match
 *   page    — 1-based page number (default 1)
 *   limit   — page size (default 20, max 100)
 *
 * Response 200: { data: IUser[], total, page, limit }
 */
const listUsersHandler = async (req, res) => {
    const { role, group, search, page, limit } = req.query;
    const filter = {};
    if (role)
        filter["role"] = role;
    if (group)
        filter["groups"] = new mongoose_1.Types.ObjectId(group);
    if (search)
        filter["username"] = { $regex: search, $options: "i" };
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
        User_1.User.find(filter)
            .populate("groups", "name")
            .sort({ username: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        User_1.User.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    res.status(200).json({ data, total, page, limit, totalPages, hasNextPage });
};
exports.listUsersHandler = listUsersHandler;
// ─── GET /users/:id ───────────────────────────────────────────────────────────
/**
 * Get a single user by MongoDB ObjectId.
 * Groups are populated with their name.
 *
 * Response 200: user document
 * Response 404: user not found
 */
const getUserHandler = async (req, res) => {
    const { id } = req.params;
    const user = await User_1.User.findById(id).populate("groups", "name").lean();
    if (!user) {
        throw new AppError_1.NotFoundError(`User ${id} not found`, "UserController");
    }
    res.status(200).json(user);
};
exports.getUserHandler = getUserHandler;
// ─── PATCH /users/:id ─────────────────────────────────────────────────────────
/**
 * Update a user's role and / or group assignments.
 *
 * Guards:
 *   - Cannot update your own account via this endpoint (use /auth/me for self-service).
 *   - All supplied group IDs must exist in the Group collection.
 *
 * Body: UpdateUserInput  { role?, groups?: ObjectId[] }
 *
 * Response 200: updated user document (groups populated)
 * Response 400: unknown group IDs
 * Response 403: attempting to modify own account
 * Response 404: user not found
 */
const updateUserHandler = async (req, res) => {
    const { id } = req.params;
    const actor = req.user;
    const updates = req.body;
    const target = await User_1.User.findById(id);
    if (!target) {
        throw new AppError_1.NotFoundError(`User ${id} not found`, "UserController");
    }
    // Prevent self-modification through the admin endpoint.
    if (target.username === actor.username) {
        throw new AppError_1.ForbiddenError("You cannot modify your own account through this endpoint.", "UserController");
    }
    // Validate that every supplied group ObjectId actually exists.
    if (updates.groups && updates.groups.length > 0) {
        const groupIds = updates.groups.map((g) => new mongoose_1.Types.ObjectId(g));
        const found = await Group_1.Group.countDocuments({ _id: { $in: groupIds } });
        if (found !== groupIds.length) {
            throw new AppError_1.BadRequestError("One or more group IDs do not exist.", "UserController");
        }
    }
    const payload = {};
    if (updates.role !== undefined)
        payload["role"] = updates.role;
    if (updates.groups !== undefined)
        payload["groups"] = updates.groups.map((g) => new mongoose_1.Types.ObjectId(g));
    const updated = await User_1.User.findByIdAndUpdate(id, { $set: payload }, { new: true, runValidators: true }).populate("groups", "name");
    loggerService_1.logger.info("User updated", "UserController", {
        targetId: id,
        targetUsername: target.username,
        updatedBy: actor.username,
        fields: Object.keys(payload),
    });
    res.status(200).json(updated);
};
exports.updateUserHandler = updateUserHandler;
// ─── DELETE /users/:id ────────────────────────────────────────────────────────
/**
 * Delete a user from the system.
 *
 * Guards:
 *   - Cannot delete your own account.
 *
 * Response 200: { message }
 * Response 403: attempting to delete own account
 * Response 404: user not found
 */
const deleteUserHandler = async (req, res) => {
    const { id } = req.params;
    const actor = req.user;
    const target = await User_1.User.findById(id);
    if (!target) {
        throw new AppError_1.NotFoundError(`User ${id} not found`, "UserController");
    }
    if (target.username === actor.username) {
        throw new AppError_1.ForbiddenError("You cannot delete your own account.", "UserController");
    }
    await User_1.User.findByIdAndDelete(id);
    loggerService_1.logger.info("User deleted", "UserController", {
        targetId: id,
        targetUsername: target.username,
        deletedBy: actor.username,
    });
    res.status(204).end();
};
exports.deleteUserHandler = deleteUserHandler;
//# sourceMappingURL=userController.js.map