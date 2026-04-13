import { Request, Response, NextFunction } from "express";
import { AccessPolicy } from "../types/auth";
/**
 * Authorization middleware factory.
 *
 * Requires `req.user` to be set by a preceding authentication middleware
 * (e.g. JWT verification or Active Directory session).
 *
 * Usage:
 * ```ts
 * import { authorize } from "../middleware/authorize";
 * import { POLICIES } from "../middleware/policies";
 *
 * // Single policy
 * router.get("/reports", authorize(POLICIES.viewReports), handler);
 *
 * // Inline policy
 * router.delete("/users/:id", authorize({ roles: ["admin"] }), handler);
 *
 * // Require ALL conditions (role AND group)
 * router.post("/approve", authorize({ roles: ["manager"], groups: ["Finance"], mode: "all" }), handler);
 * ```
 */
export declare const authorize: (policy: AccessPolicy) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=authorize.d.ts.map