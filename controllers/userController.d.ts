import { Request, Response } from "express";
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
export declare const statsUserHandler: (_req: Request, res: Response) => Promise<void>;
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
export declare const listUsersHandler: (req: Request, res: Response) => Promise<void>;
/**
 * Get a single user by MongoDB ObjectId.
 * Groups are populated with their name.
 *
 * Response 200: user document
 * Response 404: user not found
 */
export declare const getUserHandler: (req: Request, res: Response) => Promise<void>;
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
export declare const updateUserHandler: (req: Request, res: Response) => Promise<void>;
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
export declare const deleteUserHandler: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=userController.d.ts.map