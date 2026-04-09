import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/tokenService";
import { AuthenticatedUser } from "../types/auth";
import { logger } from "../services/loggerService";

/**
 * Extracts and verifies the Bearer access token from the `Authorization` header.
 * On success, populates `req.user` so downstream handlers and `authorize()`
 * can access the authenticated identity.
 *
 * Returns:
 *   401  — no token provided, token expired, or token invalid
 *
 * Usage:
 * ```ts
 * router.post("/logout", authenticate, handler);
 * router.get("/me",      authenticate, handler);
 * ```
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("Missing or malformed Authorization header", "Authenticate", {
      path: req.path,
      method: req.method,
    });
    res.status(401).json({ status: 401, message: "Authentication required." });
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid access token";
    logger.warn("Token verification failed", "Authenticate", { message, path: req.path });
    res.status(401).json({ status: 401, message });
    return;
  }

  const user: AuthenticatedUser = {
    username: payload.sub,
    role: payload.role,
    groups: payload.groups,
  };

  req.user = user;
  next();
};
