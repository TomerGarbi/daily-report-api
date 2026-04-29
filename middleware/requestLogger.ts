import { Request, Response, NextFunction } from "express";
import { logger } from "../services/loggerService";

/**
 * Logs one structured line per HTTP request after the response is sent.
 * Captures method, path, status, duration, request id, and authenticated user.
 *
 * Skips the health-check endpoint to avoid log spam from container probes.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  if (req.path === "/health") return next();

  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const username = req.user?.username ?? "anonymous";

    const meta = {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      requestId: req.id,
    };

    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${meta.durationMs}ms`;

    if (res.statusCode >= 500) {
      logger.error(message, "HTTP", meta, username);
    } else if (res.statusCode >= 400) {
      logger.warn(message, "HTTP", meta, username);
    } else {
      logger.info(message, "HTTP", meta, username);
    }
  });

  next();
};
