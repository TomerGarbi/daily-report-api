"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthUsernameLimitMax = exports.getAuthUsernameLimitWindowMs = exports.getAuthIpLimitMax = exports.getAuthIpLimitWindowMs = exports.getStrictRateLimitMax = exports.getStrictRateLimitWindowMs = exports.getDefaultRateLimitMax = exports.getDefaultRateLimitWindowMs = void 0;
require("./env");
const getDefaultRateLimitWindowMs = () => {
    return parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10); // 15 minutes
};
exports.getDefaultRateLimitWindowMs = getDefaultRateLimitWindowMs;
const getDefaultRateLimitMax = () => {
    return parseInt(process.env.RATE_LIMIT_MAX || "100", 10);
};
exports.getDefaultRateLimitMax = getDefaultRateLimitMax;
const getStrictRateLimitWindowMs = () => {
    return parseInt(process.env.STRICT_RATE_LIMIT_WINDOW_MS || "900000", 10); // 15 minutes
};
exports.getStrictRateLimitWindowMs = getStrictRateLimitWindowMs;
const getStrictRateLimitMax = () => {
    return parseInt(process.env.STRICT_RATE_LIMIT_MAX || "10", 10);
};
exports.getStrictRateLimitMax = getStrictRateLimitMax;
const getAuthIpLimitWindowMs = () => {
    return parseInt(process.env.AUTH_IP_LIMIT_WINDOW_MS || "900000", 10); // 15 minutes
};
exports.getAuthIpLimitWindowMs = getAuthIpLimitWindowMs;
const getAuthIpLimitMax = () => {
    return parseInt(process.env.AUTH_IP_LIMIT_MAX || "20", 10);
};
exports.getAuthIpLimitMax = getAuthIpLimitMax;
const getAuthUsernameLimitWindowMs = () => {
    return parseInt(process.env.AUTH_USERNAME_LIMIT_WINDOW_MS || "900000", 10); // 15 minutes
};
exports.getAuthUsernameLimitWindowMs = getAuthUsernameLimitWindowMs;
const getAuthUsernameLimitMax = () => {
    return parseInt(process.env.AUTH_USERNAME_LIMIT_MAX || "10", 10);
};
exports.getAuthUsernameLimitMax = getAuthUsernameLimitMax;
//# sourceMappingURL=rateLimiterConfig.js.map