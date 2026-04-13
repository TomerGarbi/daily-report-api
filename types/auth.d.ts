/**
 * Ordered role hierarchy — index 0 is the least privileged, last is the most.
 * A higher-ranked role implicitly satisfies all lower-rank role checks.
 */
export declare const ROLE_HIERARCHY: readonly ["guest", "user", "manager", "admin"];
export type Role = (typeof ROLE_HIERARCHY)[number];
/**
 * Represents the authenticated user attached to the request by an auth
 * middleware (e.g. JWT verification or Active Directory session validation).
 *
 * Attach to `req.user` after successful authentication.
 */
export interface AuthenticatedUser {
    /** The unique username / sAMAccountName from AD or the identity provider. */
    username: string;
    /** The user's role within the application. */
    role: Role;
    /**
     * AD/LDAP group memberships (common names, e.g. "IT-Admins", "Managers").
     * Should be populated by calling `getUserGroups()` from activeDirectoryService.
     */
    groups: string[];
    /** Any extra attributes (e.g. department, email) you want to forward. */
    attributes?: Record<string, unknown>;
}
/**
 * Defines the conditions under which access is granted.
 *
 * - `roles`     — list of roles that are allowed (honours hierarchy).
 * - `groups`    — list of AD/group names that are allowed.
 * - `usernames` — explicit username allow-list (identity exceptions).
 * - `mode`      — `"any"` (default): pass if ANY condition matches.
 *                 `"all"`: pass only if ALL specified conditions match.
 */
export interface AccessPolicy {
    roles?: Role[];
    groups?: string[];
    usernames?: string[];
    mode?: "any" | "all";
}
/**
 * The data encoded inside every signed JWT.
 * Kept minimal — only what the authorize middleware needs at runtime.
 */
export interface JwtPayload {
    /** Subject — the user's username / sAMAccountName. */
    sub: string;
    /** Application role assigned to this user. */
    role: Role;
    /** AD group memberships at the time of login. */
    groups: string[];
    /**
     * Token type flag.
     * Allows the verify functions to reject a refresh token used as an access
     * token and vice-versa without a separate signing secret check.
     */
    type: "access" | "refresh";
}
//# sourceMappingURL=auth.d.ts.map