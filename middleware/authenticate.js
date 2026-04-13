"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const tokenService_1 = require("../services/tokenService");
const loggerService_1 = require("../services/loggerService");
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
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        loggerService_1.logger.warn("Missing or malformed Authorization header", "Authenticate", {
            path: req.path,
            method: req.method,
        });
        res.status(401).json({ status: 401, message: "Authentication required." });
        return;
    }
    const token = authHeader.slice(7); // strip "Bearer "
    let payload;
    try {
        payload = (0, tokenService_1.verifyAccessToken)(token);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Invalid access token";
        loggerService_1.logger.warn("Token verification failed", "Authenticate", { message, path: req.path });
        res.status(401).json({ status: 401, message });
        return;
    }
    const user = {
        username: payload.sub,
        role: payload.role,
        groups: payload.groups,
    };
    req.user = user;
    next();
};
exports.authenticate = authenticate;
//# sourceMappingURL=authenticate.js.map