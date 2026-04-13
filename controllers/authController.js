"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.meHandler = exports.logoutHandler = exports.refreshHandler = exports.loginHandler = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ms_1 = __importDefault(require("ms"));
const authService_1 = require("../services/authService");
const tokenService_1 = require("../services/tokenService");
const jwtConfig_1 = require("../config/jwtConfig");
const denylistService_1 = require("../services/denylistService");
const AppError_1 = require("../errors/AppError");
const loggerService_1 = require("../services/loggerService");
const appConfig_1 = require("../config/appConfig");
const User_1 = require("../models/User");
const REFRESH_COOKIE = "refreshToken";
const REFRESH_COOKIE_PATH = "/api/v1/auth";
// ─── POST /auth/login ─────────────────────────────────────────────────────────
/**
 * Authenticate with username + password.
 * Dev mode: validates against hardcoded user list.
 * Production: validates via Active Directory.
 *
 * Response 200:
 *   { accessToken, refreshToken, user: { username, role, groups } }
 * Response 400: validation error
 * Response 401: invalid credentials
 */
const loginHandler = async (req, res) => {
    const { username, password } = req.body;
    const result = await (0, authService_1.login)(username, password);
    const { refreshExpiresIn } = (0, jwtConfig_1.getJwtConfig)();
    const maxAge = (0, ms_1.default)(refreshExpiresIn); // convert e.g. "7d" → milliseconds
    // Refresh token lives in an HttpOnly cookie — JS can never read it.
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
        httpOnly: true,
        secure: !(0, appConfig_1.isDevelopment)(), // HTTPS only in production
        sameSite: "strict", // no cross-site sending → CSRF protection
        path: REFRESH_COOKIE_PATH, // only sent to auth endpoints
        maxAge,
    });
    // Access token is returned in the body — client keeps it in memory only.
    res.status(200).json({
        accessToken: result.accessToken,
        user: {
            username: result.user.username,
            role: result.user.role,
            groups: result.user.groups,
        },
    });
};
exports.loginHandler = loginHandler;
// ─── POST /auth/refresh ───────────────────────────────────────────────────────
/**
 * Exchange a valid, non-denylisted refresh token for a new access token.
 *
 * Response 200: { accessToken }
 * Response 400: validation error
 * Response 401: token invalid, expired, or revoked
 */
const refreshHandler = async (req, res) => {
    // Read refresh token from the HttpOnly cookie, not the request body.
    const refreshToken = req.cookies[REFRESH_COOKIE];
    if (!refreshToken) {
        throw new AppError_1.UnauthorizedError("Refresh token cookie missing", "AuthController");
    }
    if (await (0, denylistService_1.isTokenDenylisted)(refreshToken)) {
        throw new AppError_1.UnauthorizedError("Refresh token has been revoked", "AuthController");
    }
    let payload;
    try {
        payload = (0, tokenService_1.verifyRefreshToken)(refreshToken);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Invalid refresh token";
        throw new AppError_1.UnauthorizedError(message, "AuthController");
    }
    // Look up the current user record in the DB so the new access token
    // reflects any role/group changes made since the refresh token was issued.
    const dbUser = await User_1.User.findOne({ username: payload.sub })
        .populate("groups", "name")
        .lean();
    if (!dbUser) {
        throw new AppError_1.UnauthorizedError("User no longer exists", "AuthController");
    }
    const user = {
        username: dbUser.username,
        role: dbUser.role,
        groups: dbUser.groups.map((g) => g.name),
    };
    const accessToken = (0, tokenService_1.generateAccessToken)(user);
    loggerService_1.logger.info("Access token refreshed", "AuthController", { username: user.username });
    res.status(200).json({ accessToken });
};
exports.refreshHandler = refreshHandler;
// ─── POST /auth/logout ────────────────────────────────────────────────────────
/**
 * Revoke the supplied refresh token.
 * Requires a valid access token in the Authorization header.
 *
 * Response 200: { message: "Logged out successfully" }
 * Response 400: validation error
 * Response 401: not authenticated
 */
const logoutHandler = async (req, res) => {
    // Read refresh token from the HttpOnly cookie.
    const refreshToken = req.cookies[REFRESH_COOKIE];
    if (refreshToken) {
        // Decode without verifying to read the expiry — it may already be expired
        // but we still want to denylist it to prevent any residual use.
        let expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // fallback: 7 days
        try {
            const decoded = jsonwebtoken_1.default.decode(refreshToken);
            if (decoded?.exp) {
                expiresAt = decoded.exp * 1000;
            }
        }
        catch {
            // ignore decode errors — we denylist regardless
        }
        await (0, denylistService_1.denylistToken)(refreshToken, expiresAt);
    }
    // Clear the cookie regardless of whether a token was present.
    res.clearCookie(REFRESH_COOKIE, {
        httpOnly: true,
        secure: !(0, appConfig_1.isDevelopment)(),
        sameSite: "strict",
        path: REFRESH_COOKIE_PATH,
    });
    const username = req.user.username;
    loggerService_1.logger.info("User logged out", "AuthController", { username });
    res.status(200).json({ message: "Logged out successfully" });
};
exports.logoutHandler = logoutHandler;
// ─── GET /auth/me ─────────────────────────────────────────────────────────────
/**
 * Returns the current user's profile from the database.
 * This is the authoritative source of user info — not the token.
 *
 * Response 200: { username, role, groups }
 * Response 401: not authenticated or user no longer exists
 */
const meHandler = async (req, res) => {
    const { username } = req.user;
    const dbUser = await User_1.User.findOne({ username })
        .populate("groups", "name")
        .lean();
    if (!dbUser) {
        throw new AppError_1.UnauthorizedError("User no longer exists", "AuthController");
    }
    res.status(200).json({
        username: dbUser.username,
        role: dbUser.role,
        groups: dbUser.groups.map((g) => g.name),
    });
};
exports.meHandler = meHandler;
//# sourceMappingURL=authController.js.map