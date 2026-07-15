import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
import { logger } from "../services/loggerService";

/**
 * Request-timeout middleware.
 *
 * Guards against handlers that hang forever (blocked I/O, dead upstream,
 * runaway loop, etc.) by forwarding a 504 `AppError` to the error handler
 * if a response hasn't been sent within `timeoutMs`.
 *
 * The socket itself is left to the client / Express to close naturally —
 * we don't `res.destroy()` here because a slow handler may still complete
 * and try to write, which would surface an "ERR_STREAM_WRITE_AFTER_END"
 * on top of the timeout error we already reported.
 *
 * Configure via `REQUEST_TIMEOUT_MS` env (default 30_000).
 * Set to `0` to disable (useful for streaming / SSE endpoints if we add any).
 */
export function requestTimeout(defaultMs = 30_000) {
  const configured = Number(process.env.REQUEST_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(configured) && configured >= 0 ? configured : defaultMs;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (timeoutMs === 0) {
      next();
      return;
    }

    const timer = setTimeout(() => {
      if (res.headersSent) return;
      logger.warn("Request timed out", "RequestTimeout", {
        method: req.method,
        path: req.originalUrl,
        timeoutMs,
        requestId: req.id,
      });
      next(new AppError(`Request timed out after ${timeoutMs}ms`, 504, "RequestTimeout"));
    }, timeoutMs);

    // Clear the timer as soon as the response is finished, whether it
    // succeeded, errored, or the client aborted.
    const clear = (): void => clearTimeout(timer);
    res.on("finish", clear);
    res.on("close", clear);

    next();
  };
}
