"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveDirectoryConfig = void 0;
require("./env");
const getActiveDirectoryConfig = () => {
    const url = process.env.AD_URL;
    const baseDN = process.env.AD_BASE_DN;
    const username = process.env.AD_USERNAME;
    const password = process.env.AD_PASSWORD;
    if (!url) {
        throw new Error("Missing AD_URL in environment variables");
    }
    if (!baseDN) {
        throw new Error("Missing AD_BASE_DN in environment variables");
    }
    if (!username) {
        throw new Error("Missing AD_USERNAME in environment variables");
    }
    if (!password) {
        throw new Error("Missing AD_PASSWORD in environment variables");
    }
    return {
        url,
        baseDN,
        username,
        password,
    };
};
exports.getActiveDirectoryConfig = getActiveDirectoryConfig;
//# sourceMappingURL=activeDirectoryConfig.js.map