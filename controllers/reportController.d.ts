import { Request, Response } from "express";
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