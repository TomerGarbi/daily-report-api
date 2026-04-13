import { Request, Response } from "express";
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
export declare const loginHandler: (req: Request, res: Response) => Promise<void>;
/**
 * Exchange a valid, non-denylisted refresh token for a new access token.
 *
 * Response 200: { accessToken }
 * Response 400: validation error
 * Response 401: token invalid, expired, or revoked
 */
export declare const refreshHandler: (req: Request, res: Response) => Promise<void>;
/**
 * Revoke the supplied refresh token.
 * Requires a valid access token in the Authorization header.
 *
 * Response 200: { message: "Logged out successfully" }
 * Response 400: validation error
 * Response 401: not authenticated
 */
export declare const logoutHandler: (req: Request, res: Response) => Promise<void>;
/**
 * Returns the current user's profile from the database.
 * This is the authoritative source of user info — not the token.
 *
 * Response 200: { username, role, groups }
 * Response 401: not authenticated or user no longer exists
 */
export declare const meHandler: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=authController.d.ts.map