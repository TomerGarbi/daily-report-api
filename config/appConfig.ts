import "./env";

export const getPort = (): number => {
  const port = process.env.PORT;

  if (!port) {
    throw new Error("Missing PORT in environment variables");
  }

  return parseInt(port, 10);
};

export const getNodeEnv = (): string => {
  return process.env.NODE_ENV || "development";
};

export const isDevelopment = (): boolean => {
  return getNodeEnv() === "development";
};

export const isProduction = (): boolean => {
  return getNodeEnv() === "production";
};

/**
 * Allowed CORS origins.
 * Reads `CORS_ORIGIN` (comma-separated). When unset:
 *   - in development: returns `true` to reflect the request origin (dev convenience)
 *   - in production:  throws — production must declare its allowlist explicitly
 */
export const getCorsOrigin = (): string[] | boolean => {
  const raw = process.env.CORS_ORIGIN;
  if (raw && raw.trim().length > 0) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  if (isProduction()) {
    throw new Error("Missing CORS_ORIGIN in environment variables (required in production)");
  }
  return true;
};

/**
 * Number of days to retain `Log` documents before MongoDB TTL evicts them.
 * Defaults to 30 when unset.
 */
export const getLogRetentionDays = (): number => {
  const raw = process.env.LOG_RETENTION_DAYS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
};
