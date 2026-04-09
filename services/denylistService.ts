import { logger } from "./loggerService";
import { DenylistedToken } from "../models/DenylistedToken";

/**
 * MongoDB-backed refresh token denylist.
 *
 * Revoked tokens are stored with their natural expiry time.  A TTL index on
 * `expiresAt` lets MongoDB garbage-collect expired documents automatically,
 * so no manual pruning is needed.
 *
 * The public API (`denylistToken`, `isTokenDenylisted`) is unchanged from the
 * previous in-memory implementation.
 */

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Adds a refresh token to the denylist.
 *
 * @param token      The raw JWT string.
 * @param expiresAt  Unix timestamp (ms) when the token naturally expires.
 */
export const denylistToken = async (
  token: string,
  expiresAt: number
): Promise<void> => {
  try {
    await DenylistedToken.create({
      token,
      expiresAt: new Date(expiresAt),
    });
    logger.debug("Refresh token added to denylist", "DenylistService");
  } catch (err: any) {
    // Duplicate key (token already denylisted) is harmless — ignore it.
    if (err?.code === 11000) return;
    logger.error("Failed to denylist token", "DenylistService", {
      error: String(err),
    });
  }
};

/**
 * Returns true when the given token is on the denylist
 * (i.e. has been explicitly revoked via logout).
 */
export const isTokenDenylisted = async (
  token: string
): Promise<boolean> => {
  const entry = await DenylistedToken.exists({ token });
  return entry !== null;
};
