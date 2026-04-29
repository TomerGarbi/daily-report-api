import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
import { logger } from "../services/loggerService";
import { isDevelopment } from "../config/appConfig";

// ─── 404 handler ──────────────────────────────────────────────────────────────

/**
 * Catches any request that fell through all route handlers and converts it
 * into a structured 404 response via the error handler.
 *
 * Must be registered AFTER all routes.
 */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, "Router"));
};

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
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  // ── Normalise to AppError ──────────────────────────────────────────────────
  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;

  } else if (err instanceof SyntaxError && "body" in err) {
    // express.json() parse failure
    appError = new AppError("Malformed JSON in request body", 400, "BodyParser");

  } else if (err instanceof Error) {
    // Map well-known plain Error messages from tokenService / authService
    const msg = err.message;

    if (msg === "Invalid credentials") {
      appError = new AppError(msg, 401, "AuthService");
    } else if (msg === "Access token expired" || msg === "Refresh token expired") {
      appError = new AppError(msg, 401, "TokenService");
    } else if (msg === "Invalid access token" || msg === "Invalid refresh token" || msg === "Invalid token type") {
      appError = new AppError(msg, 401, "TokenService");
    } else {
      // Unexpected / programming error
      appError = new AppError("Internal server error", 500, "Unknown", false);
    }

  } else {
    appError = new AppError("Internal server error", 500, "Unknown", false);
  }

  // ── Log ────────────────────────────────────────────────────────────────────
  const username = req.user?.username ?? "anonymous";

  if (appError.isOperational && appError.statusCode < 500) {
    logger.warn(appError.message, appError.context ?? "ErrorHandler", {
      statusCode: appError.statusCode,
      method: req.method,
      path: req.originalUrl,
      username,
      requestId: req.id,
    });
  } else {
    logger.error(appError.message, appError.context ?? "ErrorHandler", {
      statusCode: appError.statusCode,
      method: req.method,
      path: req.originalUrl,
      username,
      requestId: req.id,
      stack: err instanceof Error ? err.stack : undefined,
    });
  }

  // ── Response ───────────────────────────────────────────────────────────────
  const body: Record<string, unknown> = {
    status: appError.statusCode,
    message: appError.statusCode < 500 || isDevelopment()
      ? appError.message
      : "Internal server error",    requestId: req.id,  };

  // Attach stack trace in development for faster debugging
  if (isDevelopment() && err instanceof Error) {
    body["stack"] = err.stack;
  }

  res.status(appError.statusCode).json(body);
};
