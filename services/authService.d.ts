import { AuthenticatedUser } from "../types/auth";
export interface LoginResult {
    accessToken: string;
    refreshToken: string;
    user: Omit<AuthenticatedUser, "attributes">;
}
/**
 * Authenticates a user and returns a signed access + refresh token pair.
 *
 * - In **development** (`NODE_ENV=development`): validates against the
 *   hardcoded `DEV_USERS` list. No AD connection required.
 * - In **production**: authenticates via Active Directory, then fetches
 *   the user's group memberships and resolves their application role.
 *
 * Throws a plain `Error` with a safe message on failure (no internal details
 * are leaked — callers should return 401 without exposing the reason).
 */
export declare const login: (username: string, password: string) => Promise<LoginResult>;
//# sourceMappingURL=authService.d.ts.map