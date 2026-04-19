/**
 * Central registry of named access policies.
 *
 * Define a policy once here and reference it by name across all routes.
 * To change who can do what, only this file needs to be updated.
 *
 * Usage in a route file:
 * ```ts
 * import { authorize } from "../middleware/authorize";
 * import { POLICIES } from "../middleware/policies";
 *
 * router.get("/reports",    authorize(POLICIES.viewReports),  handler);
 * router.post("/reports",   authorize(POLICIES.createReport), handler);
 * router.delete("/reports", authorize(POLICIES.adminOnly),    handler);
 * ```
 */
export declare const POLICIES: {
    /** Any authenticated user, including guests. */
    anyAuthenticated: {
        roles: ("user" | "guest" | "manager" | "admin")[];
    };
    /** Standard users and above. */
    userAndAbove: {
        roles: ("user" | "manager" | "admin")[];
    };
    /** Managers and above. */
    managerAndAbove: {
        roles: ("manager" | "admin")[];
    };
    /** Administrators only. */
    adminOnly: {
        roles: "admin"[];
    };
    /** Anyone who can read reports (users + managers + admins). */
    viewReports: {
        roles: ("user" | "manager" | "admin")[];
    };
    /** Creating reports requires at least the user role. */
    createReport: {
        roles: ("user" | "manager" | "admin")[];
    };
    /** Approving / publishing reports requires manager level or the Reports-Admin AD group. */
    approveReport: {
        roles: ("manager" | "admin")[];
        groups: string[];
        mode: "any";
    };
    /** Deleting reports is restricted to admins or the Reports-Admin group. */
    deleteReport: {
        roles: "admin"[];
        groups: string[];
        mode: "any";
    };
    /** Viewing logs is restricted to admins or the IT-Admins AD group. */
    viewLogs: {
        roles: "admin"[];
        groups: string[];
        mode: "any";
    };
    /** Viewing the user list: managers, admins, or HR group. */
    viewUsers: {
        roles: ("manager" | "admin")[];
        groups: string[];
        mode: "any";
    };
    /** Managing users (create / update / delete) is restricted to IT-Admins or admins. */
    manageUsers: {
        roles: "admin"[];
        groups: string[];
        mode: "any";
    };
    /** Access to system configuration: admins or the IT-Admins AD group. */
    systemConfig: {
        roles: "admin"[];
        groups: string[];
        mode: "any";
    };
    /**
     * Example of an "all" mode policy:
     * The user must be a manager AND belong to the Finance group.
     */
    financeApproval: {
        roles: ("manager" | "admin")[];
        groups: string[];
        mode: "all";
    };
};
//# sourceMappingURL=policies.d.ts.map