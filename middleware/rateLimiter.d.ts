export declare const defaultRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const strictRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Auth IP limiter — keyed by the request IP.
 * Blocks brute-force attempts from the same address across all usernames.
 */
export declare const authIpLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Auth username limiter — keyed by the submitted username (case-insensitive).
 * Prevents credential stuffing against a single account regardless of IP.
 * Falls back to IP if the body has no username (e.g. malformed requests).
 */
/**
 * Refresh limiter — keyed by IP.
 * Prevents abuse of the token-refresh endpoint.
 */
export declare const refreshRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const authUsernameLimiter: import("express-rate-limit").RateLimitRequestHandler;
//# sourceMappingURL=rateLimiter.d.ts.map