"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProduction = exports.isDevelopment = exports.getNodeEnv = exports.getPort = void 0;
require("./env");
const getPort = () => {
    const port = process.env.PORT;
    if (!port) {
        throw new Error("Missing PORT in environment variables");
    }
    return parseInt(port, 10);
};
exports.getPort = getPort;
const getNodeEnv = () => {
    return process.env.NODE_ENV || "development";
};
exports.getNodeEnv = getNodeEnv;
const isDevelopment = () => {
    return (0, exports.getNodeEnv)() === "development";
};
exports.isDevelopment = isDevelopment;
const isProduction = () => {
    return (0, exports.getNodeEnv)() === "production";
};
exports.isProduction = isProduction;
//# sourceMappingURL=appConfig.js.map