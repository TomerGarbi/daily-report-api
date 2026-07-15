/**
 * errorReporter.ts
 *
 * Pluggable error reporting abstraction. The default implementation is a
 * no-op — errors are still logged via Winston through the caller, but no
 * external service is contacted. To enable an external reporter (Sentry,
 * GlitchTip, custom webhook), call `setErrorReporter()` at startup with an
 * adapter conforming to `ErrorReporter`.
 *
 * Adapters MUST NOT throw — swallow all errors internally. A crashy
 * reporter should never make the underlying error worse.
 */

import { logger } from "./loggerService";

export interface ErrorReportContext {
  /** Correlated `X-Request-Id` if the error happened inside a request. */
  requestId?: string;
  /** Authenticated username, when known. */
  username?: string;
  /** Free-form tags for filtering in the destination system. */
  tags?: Record<string, string>;
  /** Additional structured metadata. */
  extra?: Record<string, unknown>;
}

export interface ErrorReporter {
  /** Report a caught error / exception. */
  captureException(error: unknown, context?: ErrorReportContext): void;
  /** Report a plain message (no exception object available). */
  captureMessage(message: string, context?: ErrorReportContext): void;
}

/**
 * Default no-op reporter. Emits at debug level so the fact that a reporter
 * would have fired is visible in dev without cluttering prod logs.
 */
const noopReporter: ErrorReporter = {
  captureException(error, context) {
    logger.debug(
      "errorReporter: captureException (no reporter configured)",
      "ErrorReporter",
      {
        error: error instanceof Error ? error.message : String(error),
        ...context,
      },
    );
  },
  captureMessage(message, context) {
    logger.debug(
      "errorReporter: captureMessage (no reporter configured)",
      "ErrorReporter",
      { message, ...context },
    );
  },
};

let current: ErrorReporter = noopReporter;

export const setErrorReporter = (reporter: ErrorReporter): void => {
  current = reporter;
};

export const getErrorReporter = (): ErrorReporter => current;

/** Convenience — safe wrapper that never lets a broken reporter crash the caller. */
export const reportException = (error: unknown, context?: ErrorReportContext): void => {
  try {
    current.captureException(error, context);
  } catch (reporterErr) {
    logger.error("errorReporter itself threw", "ErrorReporter", {
      error: reporterErr instanceof Error ? reporterErr.message : String(reporterErr),
    });
  }
};
