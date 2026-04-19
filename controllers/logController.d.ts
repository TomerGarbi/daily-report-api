import { Request, Response } from "express";
/**
 * List logs with optional filtering and pagination.
 * Query: ListLogsQuery
 *
 * Response 200: { data: ILog[], total, page, limit, totalPages, hasNextPage }
 */
export declare const listLogsHandler: (req: Request, res: Response) => Promise<void>;
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
export declare const statsLogsHandler: (_req: Request, res: Response) => Promise<void>;
/**
 * Get a single log entry by its MongoDB ObjectId.
 *
 * Response 200: log document
 * Response 404: not found
 */
export declare const getLogHandler: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=logController.d.ts.map