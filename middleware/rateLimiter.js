"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.authUsernameLimiter = exports.refreshRateLimiter = exports.authIpLimiter = exports.strictRateLimiter = exports.defaultRateLimiter = void 0;
const express_rate_limit_1 = __importStar(require("express-rate-limit"));
const rateLimiterConfig_1 = require("../config/rateLimiterConfig");
exports.defaultRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: (0, rateLimiterConfig_1.getDefaultRateLimitWindowMs)(),
    max: (0, rateLimiterConfig_1.getDefaultRateLimitMax)(),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 429,
        message: "Too many requests, please try again later.",
    },
});
exports.strictRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: (0, rateLimiterConfig_1.getStrictRateLimitWindowMs)(),
    max: (0, rateLimiterConfig_1.getStrictRateLimitMax)(),
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
exports.authIpLimiter = (0, express_rate_limit_1.default)({
    windowMs: (0, rateLimiterConfig_1.getAuthIpLimitWindowMs)(),
    max: (0, rateLimiterConfig_1.getAuthIpLimitMax)(),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (0, express_rate_limit_1.ipKeyGenerator)(req.ip ?? "unknown"),
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
exports.refreshRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 refreshes per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 429,
        message: "Too many refresh attempts, please try again later.",
    },
});
exports.authUsernameLimiter = (0, express_rate_limit_1.default)({
    windowMs: (0, rateLimiterConfig_1.getAuthUsernameLimitWindowMs)(),
    max: (0, rateLimiterConfig_1.getAuthUsernameLimitMax)(),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const username = req.body?.username;
        return typeof username === "string" ? username.toLowerCase() : (0, express_rate_limit_1.ipKeyGenerator)(req.ip ?? "unknown");
    },
    message: {
        status: 429,
        message: "Too many login attempts for this account, please try again later.",
    },
});
//# sourceMappingURL=rateLimiter.js.map