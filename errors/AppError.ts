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
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly context: string | undefined;
  /** When false the error is not logged as an unexpected failure. */
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    context?: string,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.context = context;
    this.isOperational = isOperational;

    // Maintains proper stack trace in V8
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Convenience subclasses ───────────────────────────────────────────────────

/** 400 — malformed request or failed validation */
export class BadRequestError extends AppError {
  constructor(message = "Bad request", context?: string) {
    super(message, 400, context);
  }
}

/** 401 — not authenticated */
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", context?: string) {
    super(message, 401, context);
  }
}

/** 403 — authenticated but not permitted */
export class ForbiddenError extends AppError {
  constructor(message = "Access denied", context?: string) {
    super(message, 403, context);
  }
}

/** 404 — resource not found */
export class NotFoundError extends AppError {
  constructor(message = "Resource not found", context?: string) {
    super(message, 404, context);
  }
}

/** 409 — conflict (e.g. duplicate resource) */
export class ConflictError extends AppError {
  constructor(message = "Conflict", context?: string) {
    super(message, 409, context);
  }
}

/** 422 — request understood but semantically invalid */
export class UnprocessableError extends AppError {
  constructor(message = "Unprocessable entity", context?: string) {
    super(message, 422, context);
  }
}

/** 429 — too many requests */
export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests", context?: string) {
    super(message, 429, context);
  }
}

/** 500 — unexpected server error (non-operational) */
export class InternalError extends AppError {
  constructor(message = "Internal server error", context?: string) {
    super(message, 500, context, false);
  }
}
