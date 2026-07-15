import { Request, Response } from "express";
import { Types } from "mongoose";
import { User } from "../models/User";
import { Group } from "../models/Group";
import { AuthenticatedUser } from "../types/auth";
import { NotFoundError, BadRequestError, ForbiddenError } from "../errors/AppError";
import { logger } from "../services/loggerService";
import { audit } from "../services/auditService";
import type { ListUsersQuery, UpdateUserInput } from "../schemas/userSchemas";

// ─── GET /users/stats ───────────────────────────────────────────────────────

/**
 * Returns aggregate statistics about users in the system.
 *
 * Response 200:
 * {
 *   total,
 *   byRole:  { guest, user, manager, admin },
 *   byGroup: [{ group, groupId, count }],
 *   recent:  { last7Days, last30Days },
 *   activity: {
 *     activeNow,       // lastActivityAt within 5 min
 *     activeToday,     // lastActivityAt within 24 h
 *     dormant,         // no activity in 30+ days (or never)
 *     disabled,        // manually soft-disabled accounts
 *     neverLoggedIn,   // no lastLoginAt at all
 *   }
 * }
 */
export const statsUserHandler = async (_req: Request, res: Response): Promise<void> => {
  const now    = new Date();
  const last5m = new Date(now.getTime() -      5 * 60 * 1000);
  const last24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [byRoleAgg, byGroupAgg, recentAgg, activityAgg] = await Promise.all([
    // Count per role
    User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]),

    // Count per group (users can belong to multiple groups — unwind first)
    User.aggregate([
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
    User.aggregate([
      {
        $group: {
          _id: null,
          last7Days:  { $sum: { $cond: [{ $gte: ["$createdAt", last7]  }, 1, 0] } },
          last30Days: { $sum: { $cond: [{ $gte: ["$createdAt", last30] }, 1, 0] } },
        },
      },
    ]),

    // Activity / status counters — single pass over the collection so this
    // scales linearly with user count instead of running 5 separate counts.
    User.aggregate([
      {
        $group: {
          _id: null,
          activeNow: {
            $sum: { $cond: [{ $gte: ["$lastActivityAt", last5m] }, 1, 0] },
          },
          activeToday: {
            $sum: { $cond: [{ $gte: ["$lastActivityAt", last24] }, 1, 0] },
          },
          dormant: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$lastActivityAt", null] },
                    { $lt: ["$lastActivityAt", last30] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          disabled: {
            $sum: { $cond: [{ $eq: ["$disabled", true] }, 1, 0] },
          },
          neverLoggedIn: {
            $sum: { $cond: [{ $eq: [{ $ifNull: ["$lastLoginAt", null] }, null] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  // Shape role aggregation into { guest, user, manager, admin }
  const byRole = byRoleAgg.reduce<Record<string, number>>(
    (acc, row) => { acc[row._id as string] = row.count; return acc; },
    { guest: 0, user: 0, manager: 0, admin: 0 }
  );

  res.status(200).json({
    total:   Object.values(byRole).reduce((s, n) => s + n, 0),
    byRole,
    byGroup: byGroupAgg,
    recent: {
      last7Days:  recentAgg[0]?.last7Days  ?? 0,
      last30Days: recentAgg[0]?.last30Days ?? 0,
    },
    activity: {
      activeNow:     activityAgg[0]?.activeNow     ?? 0,
      activeToday:   activityAgg[0]?.activeToday   ?? 0,
      dormant:       activityAgg[0]?.dormant       ?? 0,
      disabled:      activityAgg[0]?.disabled      ?? 0,
      neverLoggedIn: activityAgg[0]?.neverLoggedIn ?? 0,
    },
  });
};

// ─── GET /users ───────────────────────────────────────────────────────────────

/**
 * List users with optional filtering, sorting, and pagination.
 *
 * Query params (all optional):
 *   role    — filter by exact role
 *   group   — filter by group ObjectId membership
 *   search  — partial, case-insensitive username match
 *   status  — one of "active" | "dormant" | "disabled" | "neverLoggedIn"
 *              • active   — lastActivityAt within 30 days, not disabled
 *              • dormant  — no activity 30+ days (or never), not disabled
 *              • disabled — soft-disabled accounts
 *              • neverLoggedIn — lastLoginAt is null
 *   sort    — one of "username" (default) | "lastLoginAt" | "lastActivityAt" | "createdAt"
 *   order   — "asc" | "desc" (default asc for username, desc for dates)
 *   page    — 1-based page number (default 1)
 *   limit   — page size (default 20, max 100)
 *
 * Response 200: { data: IUser[], total, page, limit, totalPages, hasNextPage }
 */
export const listUsersHandler = async (req: Request, res: Response): Promise<void> => {
  const { role, group, search, status, sort, order, page, limit } =
    req.query as unknown as ListUsersQuery;

  const filter: Record<string, unknown> = {};

  if (role)   filter["role"]   = role;
  if (group)  filter["groups"] = new Types.ObjectId(group);
  if (search) filter["username"] = { $regex: search, $options: "i" };

  // Status filter — mutually exclusive buckets computed from lastActivityAt /
  // lastLoginAt / disabled. Kept in the query layer (not client-side) so the
  // paginated counts stay honest.
  if (status) {
    const now = Date.now();
    const dormantCutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
    switch (status) {
      case "active":
        filter["disabled"] = { $ne: true };
        filter["lastActivityAt"] = { $gte: dormantCutoff };
        break;
      case "dormant":
        filter["disabled"] = { $ne: true };
        filter["$or"] = [
          { lastActivityAt: { $exists: false } },
          { lastActivityAt: null },
          { lastActivityAt: { $lt: dormantCutoff } },
        ];
        break;
      case "disabled":
        filter["disabled"] = true;
        break;
      case "neverLoggedIn":
        filter["$or"] = [
          { lastLoginAt: { $exists: false } },
          { lastLoginAt: null },
        ];
        break;
    }
  }

  // Sort — allow-listed to prevent injection of arbitrary field names.
  const sortField = sort ?? "username";
  const sortDir: 1 | -1 = order === "asc" ? 1 : order === "desc" ? -1
    : (sortField === "username" ? 1 : -1); // sensible default per field

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    User.find(filter)
      .populate("groups", "name")
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  const totalPages  = Math.ceil(total / limit);
  const hasNextPage  = page < totalPages;

  res.status(200).json({ data, total, page, limit, totalPages, hasNextPage });
};

// ─── GET /users/:id ───────────────────────────────────────────────────────────

/**
 * Get a single user by MongoDB ObjectId.
 * Groups are populated with their name.
 *
 * Response 200: user document
 * Response 404: user not found
 */
export const getUserHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const user = await User.findById(id).populate("groups", "name").lean();

  if (!user) {
    throw new NotFoundError(`User ${id} not found`, "UserController");
  }

  res.status(200).json(user);
};

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
export const updateUserHandler = async (req: Request, res: Response): Promise<void> => {
  const { id }  = req.params;
  const actor   = req.user as AuthenticatedUser;
  const updates = req.body as UpdateUserInput;

  const target = await User.findById(id);
  if (!target) {
    throw new NotFoundError(`User ${id} not found`, "UserController");
  }

  // Prevent self-modification through the admin endpoint.
  if (target.username === actor.username) {
    throw new ForbiddenError(
      "You cannot modify your own account through this endpoint.",
      "UserController"
    );
  }

  // Validate that every supplied group ObjectId actually exists.
  if (updates.groups && updates.groups.length > 0) {
    const groupIds = updates.groups.map((g) => new Types.ObjectId(g));
    const found    = await Group.countDocuments({ _id: { $in: groupIds } });
    if (found !== groupIds.length) {
      throw new BadRequestError(
        "One or more group IDs do not exist.",
        "UserController"
      );
    }
  }

  const payload: Record<string, unknown> = {};
  if (updates.role     !== undefined) payload["role"]     = updates.role;
  if (updates.groups   !== undefined) payload["groups"]   = updates.groups.map((g) => new Types.ObjectId(g));
  if (updates.disabled !== undefined) payload["disabled"] = updates.disabled;

  const updated = await User.findByIdAndUpdate(
    id,
    { $set: payload },
    { new: true, runValidators: true }
  ).populate("groups", "name");

  logger.info("User updated", "UserController", {
    targetId: id,
    targetUsername: target.username,
    updatedBy: actor.username,
    fields: Object.keys(payload),
  });

  // Emit action-specific audit events so the timeline can display "changed
  // role of X" instead of a generic "updated" entry.
  const changedFields = Object.keys(payload);
  if (payload["role"] !== undefined && payload["role"] !== target.role) {
    audit.recordSuccess({
      req,
      action: "user.role.change",
      resource: { type: "user", id: id as string, label: target.username },
      before: { role: target.role },
      after:  { role: payload["role"] },
    });
  }
  if (payload["groups"] !== undefined) {
    audit.recordSuccess({
      req,
      action: "user.groups.change",
      resource: { type: "user", id: id as string, label: target.username },
      before: { groups: target.groups.map((g) => g.toString()) },
      after:  { groups: (payload["groups"] as Types.ObjectId[]).map((g) => g.toString()) },
    });
  }
  if (payload["disabled"] !== undefined && payload["disabled"] !== target.disabled) {
    audit.recordSuccess({
      req,
      action: payload["disabled"] ? "user.disable" : "user.enable",
      resource: { type: "user", id: id as string, label: target.username },
    });
  }
  // Fallback audit if the payload contains something we didn't map above.
  if (changedFields.length === 0) {
    // Nothing to record.
  }

  res.status(200).json(updated);
};

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
export const deleteUserHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const actor  = req.user as AuthenticatedUser;

  const target = await User.findById(id);
  if (!target) {
    throw new NotFoundError(`User ${id} not found`, "UserController");
  }

  if (target.username === actor.username) {
    throw new ForbiddenError(
      "You cannot delete your own account.",
      "UserController"
    );
  }

  await User.findByIdAndDelete(id);

  logger.info("User deleted", "UserController", {
    targetId: id,
    targetUsername: target.username,
    deletedBy: actor.username,
  });

  audit.recordSuccess({
    req,
    action: "user.delete",
    resource: { type: "user", id: id as string, label: target.username },
    before: { username: target.username, role: target.role },
  });

  res.status(204).end();
};
