import { Request, Response, NextFunction } from "express";
/**
 * Catches any request that fell through all route handlers and converts it
 * into a structured 404 response via the error handler.
 *
 * Must be registered AFTER all routes.
 */
export declare const notFoundHandler: (req: Request, _res: Response, next: NextFunction) => void;
/**
 * Express 5 four-argument error handler — must be registered last in app.ts.
 *
 * Handles:
 * - `AppError` instances (operational errors): logged at warn/error level,
 *   message forwarded to the client.
 * - Unexpected errors (non-operational / unknown): logged at error level with
 *   stack trace; a generic message is returned to the client in production
 *   so internal details are never leaked.
 * - JSON parse errors from `express.json()`.
 * - JWT errors forwarded as plain Error instances.
 */
export declare const errorHandler: (err: unknown, req: Request, res: Response, _next: NextFunction) => void;
//# sourceMappingURL=errorHandler.d.ts.map