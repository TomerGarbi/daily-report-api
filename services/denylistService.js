"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTokenDenylisted = exports.denylistToken = void 0;
const loggerService_1 = require("./loggerService");
const DenylistedToken_1 = require("../models/DenylistedToken");
/**
 * MongoDB-backed refresh token denylist.
 *
 * Revoked tokens are stored with their natural expiry time.  A TTL index on
 * `expiresAt` lets MongoDB garbage-collect expired documents automatically,
 * so no manual pruning is needed.
 *
 * The public API (`denylistToken`, `isTokenDenylisted`) is unchanged from the
 * previous in-memory implementation.
 */
// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Adds a refresh token to the denylist.
 *
 * @param token      The raw JWT string.
 * @param expiresAt  Unix timestamp (ms) when the token naturally expires.
 */
const denylistToken = async (token, expiresAt) => {
    try {
        await DenylistedToken_1.DenylistedToken.create({
            token,
            expiresAt: new Date(expiresAt),
        });
        loggerService_1.logger.debug("Refresh token added to denylist", "DenylistService");
    }
    catch (err) {
        // Duplicate key (token already denylisted) is harmless — ignore it.
        if (err?.code === 11000)
            return;
        loggerService_1.logger.error("Failed to denylist token", "DenylistService", {
            error: String(err),
        });
    }
};
exports.denylistToken = denylistToken;
/**
 * Returns true when the given token is on the denylist
 * (i.e. has been explicitly revoked via logout).
 */
const isTokenDenylisted = async (token) => {
    const entry = await DenylistedToken_1.DenylistedToken.exists({ token });
    return entry !== null;
};
exports.isTokenDenylisted = isTokenDenylisted;
//# sourceMappingURL=denylistService.js.map