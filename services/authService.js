"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = void 0;
const activeDirectoryService_1 = require("./activeDirectoryService");
const tokenService_1 = require("./tokenService");
const loggerService_1 = require("./loggerService");
const appConfig_1 = require("../config/appConfig");
const User_1 = require("../models/User");
// ─── Dev user store ───────────────────────────────────────────────────────────
/**
 * Hardcoded users used in development mode only.
 * Never present in a production build.
 *
 * Password is stored in plain text here intentionally — this list is only
 * ever active when NODE_ENV=development.
 */
const DEV_USERS = [
    {
        username: "admin",
        password: "admin123",
        role: "admin",
        groups: ["IT-Admins", "Managers"],
    },
    {
        username: "manager",
        password: "manager123",
        role: "manager",
        groups: ["Managers", "Finance"],
    },
    {
        username: "user",
        password: "user123",
        role: "user",
        groups: ["Staff"],
    },
    {
        username: "guest",
        password: "guest123",
        role: "guest",
        groups: [],
    },
];
// ─── Role resolver for AD (production) ───────────────────────────────────────
/**
 * Maps AD group memberships to an application Role.
 * Edit the group-name constants here to match your real AD group names.
 *
 * Priority: admin > manager > user > guest.
 */
const resolveRole = (groups) => {
    const lower = groups.map((g) => g.toLowerCase());
    if (lower.some((g) => g.includes("it-admins") || g.includes("administrators"))) {
        return "admin";
    }
    if (lower.some((g) => g.includes("managers") || g.includes("management"))) {
        return "manager";
    }
    if (lower.some((g) => g.includes("staff") || g.includes("employees") || g.includes("users"))) {
        return "user";
    }
    return "guest";
};
// ─── First-login user provisioning ──────────────────────────────────────────
/**
 * Ensures a User document exists in the database for the given username.
 * If this is the first time the user has logged in, the document is created
 * with the resolved role so the DB record always matches the issued token.
 *
 * Role is intentionally NOT overwritten on subsequent logins — it is managed
 * in the database (e.g. promoted to admin/manager by an administrator).
 */
const upsertUserOnLogin = async (username, role) => {
    try {
        await User_1.User.findOneAndUpdate({ username }, { $setOnInsert: { role, groups: [] } }, // only applied on first insert
        { upsert: true });
        loggerService_1.logger.debug("User upserted on login", "AuthService", { username, role });
    }
    catch (err) {
        // Non-fatal but important: the issued token may contain a role/groups
        // that aren't reflected in the database. Log at warn level so it's
        // visible in production dashboards.
        loggerService_1.logger.warn("Failed to upsert user on login — token may diverge from DB", "AuthService", {
            username,
            error: err instanceof Error ? err.message : String(err),
        });
    }
};
// ─── Login ────────────────────────────────────────────────────────────────────
/**
 * Authenticates a user and returns a signed access + refresh token pair.
 *
 * - In **development** (`NODE_ENV=development`): validates against the
 *   hardcoded `DEV_USERS` list. No AD connection required.
 * - In **production**: authenticates via Active Directory, then fetches
 *   the user's group memberships and resolves their application role.
 *
 * Throws a plain `Error` with a safe message on failure (no internal details
 * are leaked — callers should return 401 without exposing the reason).
 */
const login = async (username, password) => {
    // ── Development mode ────────────────────────────────────────────────────────
    if ((0, appConfig_1.isDevelopment)()) {
        loggerService_1.logger.debug("Login attempt (dev mode)", "AuthService", { username });
        const devUser = DEV_USERS.find((u) => u.username === username && u.password === password);
        if (!devUser) {
            loggerService_1.logger.warn("Dev login failed — invalid credentials", "AuthService", { username });
            throw new Error("Invalid credentials");
        }
        const user = {
            username: devUser.username,
            role: devUser.role,
            groups: devUser.groups,
        };
        const accessToken = (0, tokenService_1.generateAccessToken)(user);
        const refreshToken = (0, tokenService_1.generateRefreshToken)(user);
        loggerService_1.logger.info("Dev login successful", "AuthService", {
            username,
            role: devUser.role,
        });
        await upsertUserOnLogin(username, devUser.role);
        return { accessToken, refreshToken, user };
    }
    // ── Production mode (Active Directory) ─────────────────────────────────────
    loggerService_1.logger.debug("Login attempt (production / AD)", "AuthService", { username });
    let authenticated;
    try {
        authenticated = await (0, activeDirectoryService_1.authenticateUser)(username, password);
    }
    catch {
        loggerService_1.logger.error("AD authentication threw an error", "AuthService", { username });
        throw new Error("Invalid credentials");
    }
    if (!authenticated) {
        loggerService_1.logger.warn("AD login failed — invalid credentials", "AuthService", { username });
        throw new Error("Invalid credentials");
    }
    let groups;
    try {
        const raw = await (0, activeDirectoryService_1.getUserGroups)(username);
        groups = raw.map((g) => (typeof g === "string" ? g : (g.cn ?? g.dn ?? "")));
    }
    catch {
        loggerService_1.logger.warn("Could not fetch AD groups, defaulting to empty", "AuthService", { username });
        groups = [];
    }
    const role = resolveRole(groups);
    const user = { username, role, groups };
    const accessToken = (0, tokenService_1.generateAccessToken)(user);
    const refreshToken = (0, tokenService_1.generateRefreshToken)(user);
    loggerService_1.logger.info("AD login successful", "AuthService", { username, role });
    // Production: new AD users are provisioned with their resolved role.
    // Existing users keep whatever role they have in the DB.
    await upsertUserOnLogin(username, role);
    return { accessToken, refreshToken, user };
};
exports.login = login;
//# sourceMappingURL=authService.js.map