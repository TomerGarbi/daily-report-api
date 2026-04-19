import { Request, Response } from "express";
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
export declare const statsReportHandler: (req: Request, res: Response) => Promise<void>;
/**
 * Create a new report.
 * Body: CreateReportInput
 *
 * Response 201: created report document
 * Response 400: validation error or user not found
 */
export declare const createReportHandler: (req: Request, res: Response) => Promise<void>;
/**
 * List reports with optional filtering and pagination.
 * Query: ListReportsQuery
 *
 * Response 200: { data: IReport[], total, page, limit }
 */
export declare const listReportsHandler: (req: Request, res: Response) => Promise<void>;
/**
 * Get a single report by its MongoDB ObjectId.
 *
 * Response 200: report document (group populated)
 * Response 404: not found
 */
export declare const getReportHandler: (req: Request, res: Response) => Promise<void>;
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
export declare const updateReportHandler: (req: Request, res: Response) => Promise<void>;
/**
 * Delete a report.
 * Restricted to admins and the Reports-Admin group (enforced by route policy).
 *
 * Response 200: { message }
 * Response 404: not found
 */
export declare const deleteReportHandler: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=reportController.d.ts.map