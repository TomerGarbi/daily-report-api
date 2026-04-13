"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJwtConfig = void 0;
require("./env");
const getJwtConfig = () => {
    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN;
    if (!secret) {
        throw new Error("Missing JWT_SECRET in environment variables");
    }
    if (!expiresIn) {
        throw new Error("Missing JWT_EXPIRES_IN in environment variables");
    }
    if (!refreshSecret) {
        throw new Error("Missing JWT_REFRESH_SECRET in environment variables");
    }
    if (!refreshExpiresIn) {
        throw new Error("Missing JWT_REFRESH_EXPIRES_IN in environment variables");
    }
    return {
        secret,
        expiresIn: expiresIn,
        refreshSecret,
        refreshExpiresIn: refreshExpiresIn,
    };
};
exports.getJwtConfig = getJwtConfig;
//# sourceMappingURL=jwtConfig.js.map