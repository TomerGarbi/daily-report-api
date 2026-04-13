"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalError = exports.TooManyRequestsError = exports.UnprocessableError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.BadRequestError = exports.AppError = void 0;
/**
 * Base application error.
 *
 * Throw this (or a subclass) anywhere in the codebase.
 * The global error handler will serialise it into a consistent JSON response.
 *
 * @example
 *   throw new AppError("User not found", 404);
 *   throw new AppError("Invalid credentials", 401, "AuthService");
 */
class AppError extends Error {
    constructor(message, statusCode = 500, context, isOperational = true) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.context = context;
        this.isOperational = isOperational;
        // Maintains proper stack trace in V8
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
// ─── Convenience subclasses ───────────────────────────────────────────────────
/** 400 — malformed request or failed validation */
class BadRequestError extends AppError {
    constructor(message = "Bad request", context) {
        super(message, 400, context);
    }
}
exports.BadRequestError = BadRequestError;
/** 401 — not authenticated */
class UnauthorizedError extends AppError {
    constructor(message = "Authentication required", context) {
        super(message, 401, context);
    }
}
exports.UnauthorizedError = UnauthorizedError;
/** 403 — authenticated but not permitted */
class ForbiddenError extends AppError {
    constructor(message = "Access denied", context) {
        super(message, 403, context);
    }
}
exports.ForbiddenError = ForbiddenError;
/** 404 — resource not found */
class NotFoundError extends AppError {
    constructor(message = "Resource not found", context) {
        super(message, 404, context);
    }
}
exports.NotFoundError = NotFoundError;
/** 409 — conflict (e.g. duplicate resource) */
class ConflictError extends AppError {
    constructor(message = "Conflict", context) {
        super(message, 409, context);
    }
}
exports.ConflictError = ConflictError;
/** 422 — request understood but semantically invalid */
class UnprocessableError extends AppError {
    constructor(message = "Unprocessable entity", context) {
        super(message, 422, context);
    }
}
exports.UnprocessableError = UnprocessableError;
/** 429 — too many requests */
class TooManyRequestsError extends AppError {
    constructor(message = "Too many requests", context) {
        super(message, 429, context);
    }
}
exports.TooManyRequestsError = TooManyRequestsError;
/** 500 — unexpected server error (non-operational) */
class InternalError extends AppError {
    constructor(message = "Internal server error", context) {
        super(message, 500, context, false);
    }
}
exports.InternalError = InternalError;
//# sourceMappingURL=AppError.js.map