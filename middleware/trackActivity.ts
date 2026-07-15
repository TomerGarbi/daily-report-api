import { Request, Response, NextFunction } from "express";
import { User } from "../models/User";
import { logger } from "../services/loggerService";

/**
 * trackActivity
 * -----------------------------------------------------------------------------
 * Updates `User.lastActivityAt` on every authenticated request, throttled so
 * we don't hammer Mongo with one write per HTTP call. A user active on a
 * multi-tab dashboard could easily generate hundreds of requests per minute;
 * that is not interesting data — the admin UI only cares about "seen in the
 * last N minutes" resolution.
 *
 * Design choices:
 *   • In-memory Map keyed by username. Bounded by MAX_TRACKED_USERS to prevent
 *     unbounded growth in the pathological "attacker probes 1M usernames" case.
 *   • Writes are fire-and-forget — a failing `updateOne` never blocks the
 *     request, mirroring the philosophy in `loggerService.writeToDatabase`.
 *   • Skips unauthenticated requests entirely (no `req.user`).
 *   • Skips the auth cookie path (`/api/v1/auth/*`) because `lastLoginAt` is
 *     the authoritative signal for logins and we don't want refresh calls
 *     inflating activity.
 *
 * Configure via `ACTIVITY_THROTTLE_MS` (default 5 minutes).
 */

const THROTTLE_MS = Number(process.env["ACTIVITY_THROTTLE_MS"] ?? 5 * 60 * 1000);
const MAX_TRACKED_USERS = 10_000;

/** Last time we successfully persisted lastActivityAt for a username. */
const lastWriteAt = new Map<string, number>();

/**
 * If the in-memory throttle map grows past `MAX_TRACKED_USERS`, drop the
 * oldest half. This is a safety valve — under normal load the map size is
 * bounded by the number of active users.
 */
function evictIfNeeded(): void {
  if (lastWriteAt.size <= MAX_TRACKED_USERS) return;
  const entries = Array.from(lastWriteAt.entries()).sort((a, b) => a[1] - b[1]);
  const toRemove = Math.floor(entries.length / 2);
  for (let i = 0; i < toRemove; i++) {
    const entry = entries[i];
    if (entry) lastWriteAt.delete(entry[0]);
  }
}

export const trackActivity = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const username = req.user?.username;
  if (!username) return next();

  // Refresh / logout traffic is covered by lastLoginAt; skip to keep the
  // activity signal meaningful.
  if (req.path.startsWith("/api/v1/auth/")) return next();

  const now = Date.now();
  const last = lastWriteAt.get(username);
  if (last !== undefined && now - last < THROTTLE_MS) {
    return next();
  }

  // Mark first so a burst of concurrent requests don't all schedule writes.
  lastWriteAt.set(username, now);
  evictIfNeeded();

  User.updateOne({ username }, { $set: { lastActivityAt: new Date(now) } })
    .catch((err) => {
      // Roll back the throttle stamp so the next request will retry.
      lastWriteAt.delete(username);
      logger.debug("trackActivity: updateOne failed", "TrackActivity", {
        username,
        error: err instanceof Error ? err.message : String(err),
      });
    });

  next();
};

/** Test helper — resets the in-memory throttle map. Not exported publicly. */
export const _resetActivityThrottle = (): void => {
  lastWriteAt.clear();
};
