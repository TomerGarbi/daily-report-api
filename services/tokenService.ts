import jwt from "jsonwebtoken";
import { getJwtConfig } from "../config/jwtConfig";
import { AuthenticatedUser, JwtPayload } from "../types/auth";
import { logger } from "./loggerService";

// ─── Token generation ─────────────────────────────────────────────────────────

/**
 * Signs a short-lived access token for the given user.
 * The token encodes username (sub), role, groups, and type = "access".
 */
export const generateAccessToken = (user: AuthenticatedUser): string => {
  const { secret, expiresIn } = getJwtConfig();

  const payload: JwtPayload = {
    sub: user.username,
    role: user.role,
    groups: user.groups,
    type: "access",
  };

  const token = jwt.sign(payload, secret, { expiresIn });

  logger.debug("Access token generated", "TokenService", {
    username: user.username,
    expiresIn,
  });

  return token;
};

/**
 * Signs a long-lived refresh token for the given user.
 * Uses a separate secret so refresh tokens cannot be presented as access tokens.
 */
export const generateRefreshToken = (user: AuthenticatedUser): string => {
  const { refreshSecret, refreshExpiresIn } = getJwtConfig();

  const payload: JwtPayload = {
    sub: user.username,
    role: user.role,
    groups: user.groups,
    type: "refresh",
  };

  const token = jwt.sign(payload, refreshSecret, { expiresIn: refreshExpiresIn });

  logger.debug("Refresh token generated", "TokenService", {
    username: user.username,
    expiresIn: refreshExpiresIn,
  });

  return token;
};

// ─── Token verification ───────────────────────────────────────────────────────

/**
 * Verifies an access token and returns its decoded payload.
 *
 * Throws a descriptive error when:
 * - The signature is invalid
 * - The token is expired
 * - The token type is not "access" (e.g. a refresh token was submitted)
 */
export const verifyAccessToken = (token: string): JwtPayload => {
  const { secret } = getJwtConfig();

  let decoded: jwt.JwtPayload;

  try {
    decoded = jwt.verify(token, secret) as jwt.JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      logger.warn("Access token expired", "TokenService");
      throw new Error("Access token expired");
    }
    if (err instanceof jwt.JsonWebTokenError) {
      logger.warn("Invalid access token", "TokenService", { error: err.message });
      throw new Error("Invalid access token");
    }
    throw err;
  }

  if (decoded["type"] !== "access") {
    logger.warn("Wrong token type presented as access token", "TokenService", {
      type: decoded["type"],
    });
    throw new Error("Invalid token type");
  }

  return {
    sub: decoded["sub"] as string,
    role: decoded["role"],
    groups: decoded["groups"] ?? [],
    type: "access",
  };
};

/**
 * Verifies a refresh token and returns its decoded payload.
 *
 * Throws a descriptive error when:
 * - The signature is invalid
 * - The token is expired
 * - The token type is not "refresh" (e.g. an access token was submitted)
 */
export const verifyRefreshToken = (token: string): JwtPayload => {
  const { refreshSecret } = getJwtConfig();

  let decoded: jwt.JwtPayload;

  try {
    decoded = jwt.verify(token, refreshSecret) as jwt.JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      logger.warn("Refresh token expired", "TokenService");
      throw new Error("Refresh token expired");
    }
    if (err instanceof jwt.JsonWebTokenError) {
      logger.warn("Invalid refresh token", "TokenService", { error: err.message });
      throw new Error("Invalid refresh token");
    }
    throw err;
  }

  if (decoded["type"] !== "refresh") {
    logger.warn("Wrong token type presented as refresh token", "TokenService", {
      type: decoded["type"],
    });
    throw new Error("Invalid token type");
  }

  return {
    sub: decoded["sub"] as string,
    role: decoded["role"],
    groups: decoded["groups"] ?? [],
    type: "refresh",
  };
};
