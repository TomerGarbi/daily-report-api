import "./env";

export const getDefaultRateLimitWindowMs = (): number => {
  return parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10); // 15 minutes
};

export const getDefaultRateLimitMax = (): number => {
  return parseInt(process.env.RATE_LIMIT_MAX || "100", 10);
};

export const getStrictRateLimitWindowMs = (): number => {
  return parseInt(process.env.STRICT_RATE_LIMIT_WINDOW_MS || "900000", 10); // 15 minutes
};

export const getStrictRateLimitMax = (): number => {
  return parseInt(process.env.STRICT_RATE_LIMIT_MAX || "10", 10);
};

export const getAuthIpLimitWindowMs = (): number => {
  return parseInt(process.env.AUTH_IP_LIMIT_WINDOW_MS || "900000", 10); // 15 minutes
};

export const getAuthIpLimitMax = (): number => {
  return parseInt(process.env.AUTH_IP_LIMIT_MAX || "20", 10);
};

export const getAuthUsernameLimitWindowMs = (): number => {
  return parseInt(process.env.AUTH_USERNAME_LIMIT_WINDOW_MS || "900000", 10); // 15 minutes
};

export const getAuthUsernameLimitMax = (): number => {
  return parseInt(process.env.AUTH_USERNAME_LIMIT_MAX || "10", 10);
};
