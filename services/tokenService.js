"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRefreshToken = exports.verifyAccessToken = exports.generateRefreshToken = exports.generateAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwtConfig_1 = require("../config/jwtConfig");
const loggerService_1 = require("./loggerService");
// ─── Token generation ─────────────────────────────────────────────────────────
/**
 * Signs a short-lived access token for the given user.
 * The token encodes username (sub), role, groups, and type = "access".
 */
const generateAccessToken = (user) => {
    const { secret, expiresIn } = (0, jwtConfig_1.getJwtConfig)();
    const payload = {
        sub: user.username,
        role: user.role,
        groups: user.groups,
        type: "access",
    };
    const token = jsonwebtoken_1.default.sign(payload, secret, { expiresIn });
    loggerService_1.logger.debug("Access token generated", "TokenService", {
        username: user.username,
        expiresIn,
    });
    return token;
};
exports.generateAccessToken = generateAccessToken;
/**
 * Signs a long-lived refresh token for the given user.
 * Uses a separate secret so refresh tokens cannot be presented as access tokens.
 */
const generateRefreshToken = (user) => {
    const { refreshSecret, refreshExpiresIn } = (0, jwtConfig_1.getJwtConfig)();
    const payload = {
        sub: user.username,
        role: user.role,
        groups: user.groups,
        type: "refresh",
    };
    const token = jsonwebtoken_1.default.sign(payload, refreshSecret, { expiresIn: refreshExpiresIn });
    loggerService_1.logger.debug("Refresh token generated", "TokenService", {
        username: user.username,
        expiresIn: refreshExpiresIn,
    });
    return token;
};
exports.generateRefreshToken = generateRefreshToken;
// ─── Token verification ───────────────────────────────────────────────────────
/**
 * Verifies an access token and returns its decoded payload.
 *
 * Throws a descriptive error when:
 * - The signature is invalid
 * - The token is expired
 * - The token type is not "access" (e.g. a refresh token was submitted)
 */
const verifyAccessToken = (token) => {
    const { secret } = (0, jwtConfig_1.getJwtConfig)();
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(token, secret);
    }
    catch (err) {
        if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
            loggerService_1.logger.warn("Access token expired", "TokenService");
            throw new Error("Access token expired");
        }
        if (err instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            loggerService_1.logger.warn("Invalid access token", "TokenService", { error: err.message });
            throw new Error("Invalid access token");
        }
        throw err;
    }
    if (decoded["type"] !== "access") {
        loggerService_1.logger.warn("Wrong token type presented as access token", "TokenService", {
            type: decoded["type"],
        });
        throw new Error("Invalid token type");
    }
    return {
        sub: decoded["sub"],
        role: decoded["role"],
        groups: decoded["groups"] ?? [],
        type: "access",
    };
};
exports.verifyAccessToken = verifyAccessToken;
/**
 * Verifies a refresh token and returns its decoded payload.
 *
 * Throws a descriptive error when:
 * - The signature is invalid
 * - The token is expired
 * - The token type is not "refresh" (e.g. an access token was submitted)
 */
const verifyRefreshToken = (token) => {
    const { refreshSecret } = (0, jwtConfig_1.getJwtConfig)();
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(token, refreshSecret);
    }
    catch (err) {
        if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
            loggerService_1.logger.warn("Refresh token expired", "TokenService");
            throw new Error("Refresh token expired");
        }
        if (err instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            loggerService_1.logger.warn("Invalid refresh token", "TokenService", { error: err.message });
            throw new Error("Invalid refresh token");
        }
        throw err;
    }
    if (decoded["type"] !== "refresh") {
        loggerService_1.logger.warn("Wrong token type presented as refresh token", "TokenService", {
            type: decoded["type"],
        });
        throw new Error("Invalid token type");
    }
    return {
        sub: decoded["sub"],
        role: decoded["role"],
        groups: decoded["groups"] ?? [],
        type: "refresh",
    };
};
exports.verifyRefreshToken = verifyRefreshToken;
//# sourceMappingURL=tokenService.js.map