import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { Request } from "express";
import {
  getDefaultRateLimitMax,
  getDefaultRateLimitWindowMs,
  getStrictRateLimitMax,
  getStrictRateLimitWindowMs,
  getAuthIpLimitMax,
  getAuthIpLimitWindowMs,
  getAuthUsernameLimitMax,
  getAuthUsernameLimitWindowMs,
} from "../config/rateLimiterConfig";

export const defaultRateLimiter = rateLimit({
  windowMs: getDefaultRateLimitWindowMs(),
  max: getDefaultRateLimitMax(),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: "Too many requests, please try again later.",
  },
});

export const strictRateLimiter = rateLimit({
  windowMs: getStrictRateLimitWindowMs(),
  max: getStrictRateLimitMax(),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: "Too many requests, please try again later.",
  },
});

/**
 * Auth IP limiter — keyed by the request IP.
 * Blocks brute-force attempts from the same address across all usernames.
 */
export const authIpLimiter = rateLimit({
  windowMs: getAuthIpLimitWindowMs(),
  max: getAuthIpLimitMax(),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => ipKeyGenerator(req.ip ?? "unknown"),
  message: {
    status: 429,
    message: "Too many login attempts from this IP, please try again later.",
  },
});

/**
 * Auth username limiter — keyed by the submitted username (case-insensitive).
 * Prevents credential stuffing against a single account regardless of IP.
 * Falls back to IP if the body has no username (e.g. malformed requests).
 */
/**
 * Refresh limiter — keyed by IP.
 * Prevents abuse of the token-refresh endpoint.
 */
export const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 30,                     // 30 refreshes per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: "Too many refresh attempts, please try again later.",
  },
});

export const authUsernameLimiter = rateLimit({
  windowMs: getAuthUsernameLimitWindowMs(),
  max: getAuthUsernameLimitMax(),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    const username = req.body?.username;
    return typeof username === "string" ? username.toLowerCase() : ipKeyGenerator(req.ip ?? "unknown");
  },
  message: {
    status: 429,
    message: "Too many login attempts for this account, please try again later.",
  },
});
