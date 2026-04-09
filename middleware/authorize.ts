import { Request, Response, NextFunction } from "express";
import { AccessPolicy, AuthenticatedUser, Role, ROLE_HIERARCHY } from "../types/auth";
import { logger } from "../services/loggerService";

// ─── Role resolution ──────────────────────────────────────────────────────────

/**
 * Returns the numeric rank of a role within the hierarchy.
 * A higher number means more privilege.
 */
function roleRank(role: Role): number {
  return ROLE_HIERARCHY.indexOf(role);
}

/**
 * Returns true when the user's role is equal to OR above the required role
 * in the hierarchy.
 *
 * Examples:
 *   meetsRole("admin",   "manager") → true   (admin ≥ manager)
 *   meetsRole("user",    "manager") → false  (user < manager)
 *   meetsRole("manager", "manager") → true
 */
function meetsRole(userRole: Role, requiredRole: Role): boolean {
  return roleRank(userRole) >= roleRank(requiredRole);
}

// ─── Policy evaluation ────────────────────────────────────────────────────────

/**
 * Evaluates a user against an access policy.
 *
 * In `"any"` mode (default) the user passes if at least one condition is met:
 *   • their role satisfies any role listed in the policy (hierarchy-aware), OR
 *   • they belong to any group listed in the policy, OR
 *   • their username is explicitly listed.
 *
 * In `"all"` mode every specified condition category must be satisfied:
 *   • the user's role must satisfy ALL listed roles, AND
 *   • the user must belong to ALL listed groups, AND
 *   • the username must appear in the list.
 *   (categories not listed in the policy are ignored in both modes.)
 */
function evaluatePolicy(user: AuthenticatedUser, policy: AccessPolicy): boolean {
  const mode = policy.mode ?? "any";

  const checks: boolean[] = [];

  if (policy.roles && policy.roles.length > 0) {
    const roleMatch = policy.roles.some((r) => meetsRole(user.role, r));
    checks.push(roleMatch);
  }

  if (policy.groups && policy.groups.length > 0) {
    const userGroups = user.groups.map((g) => g.toLowerCase());
    const groupMatch =
      mode === "all"
        ? policy.groups.every((g) => userGroups.includes(g.toLowerCase()))
        : policy.groups.some((g) => userGroups.includes(g.toLowerCase()));
    checks.push(groupMatch);
  }

  if (policy.usernames && policy.usernames.length > 0) {
    const usernameMatch = policy.usernames
      .map((u) => u.toLowerCase())
      .includes(user.username.toLowerCase());
    checks.push(usernameMatch);
  }

  // No conditions defined → deny by default (misconfigured policy)
  if (checks.length === 0) return false;

  return mode === "all" ? checks.every(Boolean) : checks.some(Boolean);
}

// ─── Middleware factory ───────────────────────────────────────────────────────

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
export const authorize = (policy: AccessPolicy) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as AuthenticatedUser | undefined;

    // 401 — not authenticated yet
    if (!user) {
      logger.warn("Authorization attempted without authenticated user", "Authorize", {
        path: req.path,
        method: req.method,
      });
      res.status(401).json({ status: 401, message: "Authentication required." });
      return;
    }

    const granted = evaluatePolicy(user, policy);

    if (!granted) {
      logger.warn("Access denied", "Authorize", {
        username: user.username,
        role: user.role,
        groups: user.groups,
        path: req.path,
        method: req.method,
        policy,
      });
      res.status(403).json({ status: 403, message: "Access denied." });
      return;
    }

    logger.debug("Access granted", "Authorize", {
      username: user.username,
      role: user.role,
      path: req.path,
      method: req.method,
    });

    next();
  };
};
