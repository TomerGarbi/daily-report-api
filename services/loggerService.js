"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const path_1 = __importDefault(require("path"));
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const loggerConfig_1 = require("../config/loggerConfig");
const Log_1 = require("../models/Log");
// ─── Custom format ────────────────────────────────────────────────────────────
const jsonFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json());
// ─── File transport (daily-rotated) ───────────────────────────────────────────
const logFilePath = (0, loggerConfig_1.getLogFilePath)();
const logDir = path_1.default.dirname(logFilePath);
const logBaseName = path_1.default.basename(logFilePath, path_1.default.extname(logFilePath));
const fileTransport = new winston_daily_rotate_file_1.default({
    dirname: logDir,
    filename: `${logBaseName}-%DATE%`,
    extension: path_1.default.extname(logFilePath) || ".log",
    datePattern: "YYYY-MM-DD",
    maxFiles: "30d", // keep 30 days of logs
    maxSize: "20m", // rotate at 20 MB
    format: jsonFormat,
});
// ─── Console transport (dev only) ─────────────────────────────────────────────
const consoleTransport = new winston_1.default.transports.Console({
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.colorize(), winston_1.default.format.printf(({ timestamp, level, message, context, ...meta }) => {
        const ctx = context ? ` [${context}]` : "";
        const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
        return `[${timestamp}] ${level}${ctx}: ${message}${extra}`;
    })),
});
// ─── Winston instance ─────────────────────────────────────────────────────────
const winstonLogger = winston_1.default.createLogger({
    level: (0, loggerConfig_1.getLogLevel)(),
    defaultMeta: {},
    transports: [
        fileTransport,
        ...(!(0, loggerConfig_1.isProduction)() ? [consoleTransport] : []),
    ],
});
// ─── DB write helper (fire-and-forget) ────────────────────────────────────────
const writeToDatabase = (level, message, user, context, meta) => {
    // Intentionally not awaited — log persistence must never block the request.
    Log_1.Log.create({
        timestamp: new Date(),
        level,
        message,
        user,
        ...(context && { context }),
        ...(meta && { meta }),
    }).catch((err) => {
        // Write to stderr so it doesn't recurse into the logger.
        process.stderr.write(`[LoggerService] DB write failed: ${err}\n`);
    });
};
// ─── Public API (preserves the existing call signature) ───────────────────────
class LoggerService {
    log(level, message, context, meta, user = "system") {
        winstonLogger.log({ level, message, context, user, ...meta });
        writeToDatabase(level, message, user, context, meta);
    }
    info(message, context, meta, user = "system") {
        this.log("info", message, context, meta, user);
    }
    warn(message, context, meta, user = "system") {
        this.log("warn", message, context, meta, user);
    }
    error(message, context, meta, user = "system") {
        this.log("error", message, context, meta, user);
    }
    debug(message, context, meta, user = "system") {
        this.log("debug", message, context, meta, user);
    }
}
exports.logger = new LoggerService();
//# sourceMappingURL=loggerService.js.map