"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.notFoundHandler = void 0;
const AppError_1 = require("../errors/AppError");
const loggerService_1 = require("../services/loggerService");
const appConfig_1 = require("../config/appConfig");
// ─── 404 handler ──────────────────────────────────────────────────────────────
/**
 * Catches any request that fell through all route handlers and converts it
 * into a structured 404 response via the error handler.
 *
 * Must be registered AFTER all routes.
 */
const notFoundHandler = (req, _res, next) => {
    next(new AppError_1.AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, "Router"));
};
exports.notFoundHandler = notFoundHandler;
// ─── Global error handler ─────────────────────────────────────────────────────
/**
 * Express 5 four-argument error handler — must be registered last in app.ts.
 *
 * Handles:
 * - `AppError` instances (operational errors): logged at warn/error level,
 *   message forwarded to the client.
 * - Unexpected errors (non-operational / unknown): logged at error level with
 *   stack trace; a generic message is returned to the client in production
 *   so internal details are never leaked.
 * - JSON parse errors from `express.json()`.
 * - JWT errors forwarded as plain Error instances.
 */
const errorHandler = (err, req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
_next) => {
    // ── Normalise to AppError ──────────────────────────────────────────────────
    let appError;
    if (err instanceof AppError_1.AppError) {
        appError = err;
    }
    else if (err instanceof SyntaxError && "body" in err) {
        // express.json() parse failure
        appError = new AppError_1.AppError("Malformed JSON in request body", 400, "BodyParser");
    }
    else if (err instanceof Error) {
        // Map well-known plain Error messages from tokenService / authService
        const msg = err.message;
        if (msg === "Invalid credentials") {
            appError = new AppError_1.AppError(msg, 401, "AuthService");
        }
        else if (msg === "Access token expired" || msg === "Refresh token expired") {
            appError = new AppError_1.AppError(msg, 401, "TokenService");
        }
        else if (msg === "Invalid access token" || msg === "Invalid refresh token" || msg === "Invalid token type") {
            appError = new AppError_1.AppError(msg, 401, "TokenService");
        }
        else {
            // Unexpected / programming error
            appError = new AppError_1.AppError("Internal server error", 500, "Unknown", false);
        }
    }
    else {
        appError = new AppError_1.AppError("Internal server error", 500, "Unknown", false);
    }
    // ── Log ────────────────────────────────────────────────────────────────────
    const username = req.user?.username ?? "anonymous";
    if (appError.isOperational && appError.statusCode < 500) {
        loggerService_1.logger.warn(appError.message, appError.context ?? "ErrorHandler", {
            statusCode: appError.statusCode,
            method: req.method,
            path: req.originalUrl,
            username,
        });
    }
    else {
        loggerService_1.logger.error(appError.message, appError.context ?? "ErrorHandler", {
            statusCode: appError.statusCode,
            method: req.method,
            path: req.originalUrl,
            username,
            stack: err instanceof Error ? err.stack : undefined,
        });
    }
    // ── Response ───────────────────────────────────────────────────────────────
    const body = {
        status: appError.statusCode,
        message: appError.statusCode < 500 || (0, appConfig_1.isDevelopment)()
            ? appError.message
            : "Internal server error",
    };
    // Attach stack trace in development for faster debugging
    if ((0, appConfig_1.isDevelopment)() && err instanceof Error) {
        body["stack"] = err.stack;
    }
    res.status(appError.statusCode).json(body);
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.js.map