import { Request, Response, NextFunction } from "express";
type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;
/**
 * Wraps async route handlers to catch errors and pass them to Express error handling middleware
 * @param fn - Async function to wrap
 * @returns Wrapped function that catches errors
 */
export declare const asyncHandler: (fn: AsyncRequestHandler) => (req: Request, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=asyncHandler.d.ts.map