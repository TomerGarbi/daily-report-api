import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import ms from "ms";
import { login } from "../services/authService";
import { verifyRefreshToken, generateAccessToken } from "../services/tokenService";
import { getJwtConfig } from "../config/jwtConfig";
import { denylistToken, isTokenDenylisted } from "../services/denylistService";
import { UnauthorizedError } from "../errors/AppError";
import { AuthenticatedUser } from "../types/auth";
import { logger } from "../services/loggerService";
import { isDevelopment } from "../config/appConfig";
import { User } from "../models/User";

const REFRESH_COOKIE = "refreshToken";

// ─── POST /auth/login ─────────────────────────────────────────────────────────

/**
 * Authenticate with username + password.
 * Dev mode: validates against hardcoded user list.
 * Production: validates via Active Directory.
 *
 * Response 200:
 *   { accessToken, refreshToken, user: { username, role, groups } }
 * Response 400: validation error
 * Response 401: invalid credentials
 */
export const loginHandler = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username: string; password: string };

  const result = await login(username, password);

  const { refreshExpiresIn } = getJwtConfig();
  const maxAge = ms(refreshExpiresIn); // convert e.g. "7d" → milliseconds

  // Refresh token lives in an HttpOnly cookie — JS can never read it.
  res.cookie(REFRESH_COOKIE, result.refreshToken, {
    httpOnly: true,
    secure: !isDevelopment(),   // HTTPS only in production
    sameSite: "strict",         // no cross-site sending → CSRF protection
    maxAge,
  });

  // Access token is returned in the body — client keeps it in memory only.
  res.status(200).json({
    accessToken: result.accessToken,
    user: {
      username: result.user.username,
      role: result.user.role,
      groups: result.user.groups,
    },
  });
};

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

/**
 * Exchange a valid, non-denylisted refresh token for a new access token.
 *
 * Response 200: { accessToken }
 * Response 400: validation error
 * Response 401: token invalid, expired, or revoked
 */
export const refreshHandler = async (req: Request, res: Response): Promise<void> => {
  // Read refresh token from the HttpOnly cookie, not the request body.
  const refreshToken: string | undefined = req.cookies[REFRESH_COOKIE];

  if (!refreshToken) {
    throw new UnauthorizedError("Refresh token cookie missing", "AuthController");
  }

  if (await isTokenDenylisted(refreshToken)) {
    throw new UnauthorizedError("Refresh token has been revoked", "AuthController");
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid refresh token";
    throw new UnauthorizedError(message, "AuthController");
  }

  // Look up the current user record in the DB so the new access token
  // reflects any role/group changes made since the refresh token was issued.
  const dbUser = await User.findOne({ username: payload.sub })
    .populate<{ groups: { name: string }[] }>("groups", "name")
    .lean();

  const user: AuthenticatedUser = dbUser
    ? {
        username: dbUser.username,
        role: dbUser.role,
        groups: dbUser.groups.map((g) => g.name),
      }
    : {
        // Fallback to token values if the user record doesn't exist yet
        username: payload.sub,
        role: payload.role,
        groups: payload.groups,
      };

  const accessToken = generateAccessToken(user);

  logger.info("Access token refreshed", "AuthController", { username: user.username });

  res.status(200).json({ accessToken });
};

// ─── POST /auth/logout ────────────────────────────────────────────────────────

/**
 * Revoke the supplied refresh token.
 * Requires a valid access token in the Authorization header.
 *
 * Response 200: { message: "Logged out successfully" }
 * Response 400: validation error
 * Response 401: not authenticated
 */
export const logoutHandler = async (req: Request, res: Response): Promise<void> => {
  // Read refresh token from the HttpOnly cookie.
  const refreshToken: string | undefined = req.cookies[REFRESH_COOKIE];

  if (refreshToken) {
    // Decode without verifying to read the expiry — it may already be expired
    // but we still want to denylist it to prevent any residual use.
    let expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // fallback: 7 days
    try {
      const decoded = jwt.decode(refreshToken) as { exp?: number } | null;
      if (decoded?.exp) {
        expiresAt = decoded.exp * 1000;
      }
    } catch {
      // ignore decode errors — we denylist regardless
    }

    await denylistToken(refreshToken, expiresAt);
  }

  // Clear the cookie regardless of whether a token was present.
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: !isDevelopment(),
    sameSite: "strict",
  });

  const username = (req.user as AuthenticatedUser).username;
  logger.info("User logged out", "AuthController", { username });

  res.status(200).json({ message: "Logged out successfully" });
};

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

/**
 * Returns the profile of the currently authenticated user decoded from the
 * access token. No database lookup — the token is the source of truth.
 *
 * Response 200: { username, role, groups }
 * Response 401: not authenticated
 */
export const meHandler = async (req: Request, res: Response): Promise<void> => {
  const user = req.user as AuthenticatedUser;

  res.status(200).json({
    username: user.username,
    role: user.role,
    groups: user.groups,
  });
};
