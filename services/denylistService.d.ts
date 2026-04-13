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
/**
 * Adds a refresh token to the denylist.
 *
 * @param token      The raw JWT string.
 * @param expiresAt  Unix timestamp (ms) when the token naturally expires.
 */
export declare const denylistToken: (token: string, expiresAt: number) => Promise<void>;
/**
 * Returns true when the given token is on the denylist
 * (i.e. has been explicitly revoked via logout).
 */
export declare const isTokenDenylisted: (token: string) => Promise<boolean>;
//# sourceMappingURL=denylistService.d.ts.map