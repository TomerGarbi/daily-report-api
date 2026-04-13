import { Request, Response, NextFunction } from "express";
/**
 * Extracts and verifies the Bearer access token from the `Authorization` header.
 * On success, populates `req.user` so downstream handlers and `authorize()`
 * can access the authenticated identity.
 *
 * Returns:
 *   401  — no token provided, token expired, or token invalid
 *
 * Usage:
 * ```ts
 * router.post("/logout", authenticate, handler);
 * router.get("/me",      authenticate, handler);
 * ```
 */
export declare const authenticate: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=authenticate.d.ts.map