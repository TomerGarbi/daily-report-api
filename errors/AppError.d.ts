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
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly context: string | undefined;
    /** When false the error is not logged as an unexpected failure. */
    readonly isOperational: boolean;
    constructor(message: string, statusCode?: number, context?: string, isOperational?: boolean);
}
/** 400 — malformed request or failed validation */
export declare class BadRequestError extends AppError {
    constructor(message?: string, context?: string);
}
/** 401 — not authenticated */
export declare class UnauthorizedError extends AppError {
    constructor(message?: string, context?: string);
}
/** 403 — authenticated but not permitted */
export declare class ForbiddenError extends AppError {
    constructor(message?: string, context?: string);
}
/** 404 — resource not found */
export declare class NotFoundError extends AppError {
    constructor(message?: string, context?: string);
}
/** 409 — conflict (e.g. duplicate resource) */
export declare class ConflictError extends AppError {
    constructor(message?: string, context?: string);
}
/** 422 — request understood but semantically invalid */
export declare class UnprocessableError extends AppError {
    constructor(message?: string, context?: string);
}
/** 429 — too many requests */
export declare class TooManyRequestsError extends AppError {
    constructor(message?: string, context?: string);
}
/** 500 — unexpected server error (non-operational) */
export declare class InternalError extends AppError {
    constructor(message?: string, context?: string);
}
//# sourceMappingURL=AppError.d.ts.map