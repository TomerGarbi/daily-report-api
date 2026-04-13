"use strict";
// ─── Role Hierarchy ───────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_HIERARCHY = void 0;
/**
 * Ordered role hierarchy — index 0 is the least privileged, last is the most.
 * A higher-ranked role implicitly satisfies all lower-rank role checks.
 */
exports.ROLE_HIERARCHY = ["guest", "user", "manager", "admin"];
//# sourceMappingURL=auth.js.map