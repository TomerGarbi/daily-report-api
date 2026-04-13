import { AuthenticatedUser, JwtPayload } from "../types/auth";
/**
 * Signs a short-lived access token for the given user.
 * The token encodes username (sub), role, groups, and type = "access".
 */
export declare const generateAccessToken: (user: AuthenticatedUser) => string;
/**
 * Signs a long-lived refresh token for the given user.
 * Uses a separate secret so refresh tokens cannot be presented as access tokens.
 */
export declare const generateRefreshToken: (user: AuthenticatedUser) => string;
/**
 * Verifies an access token and returns its decoded payload.
 *
 * Throws a descriptive error when:
 * - The signature is invalid
 * - The token is expired
 * - The token type is not "access" (e.g. a refresh token was submitted)
 */
export declare const verifyAccessToken: (token: string) => JwtPayload;
/**
 * Verifies a refresh token and returns its decoded payload.
 *
 * Throws a descriptive error when:
 * - The signature is invalid
 * - The token is expired
 * - The token type is not "refresh" (e.g. an access token was submitted)
 */
export declare const verifyRefreshToken: (token: string) => JwtPayload;
//# sourceMappingURL=tokenService.d.ts.map