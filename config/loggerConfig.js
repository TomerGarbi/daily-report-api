"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProduction = exports.getLogLevel = exports.getLogFilePath = void 0;
require("./env");
const getLogFilePath = () => {
    const logFilePath = process.env.LOG_FILE_PATH;
    if (!logFilePath) {
        throw new Error("Missing LOG_FILE_PATH in environment variables");
    }
    return logFilePath;
};
exports.getLogFilePath = getLogFilePath;
const getLogLevel = () => {
    return process.env.LOG_LEVEL || "info";
};
exports.getLogLevel = getLogLevel;
const isProduction = () => {
    return process.env.NODE_ENV === "production";
};
exports.isProduction = isProduction;
//# sourceMappingURL=loggerConfig.js.map