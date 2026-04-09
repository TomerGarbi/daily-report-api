import path from "path";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { getLogFilePath, getLogLevel, isProduction } from "../config/loggerConfig";
import { Log } from "../models/Log";

// ─── Custom format ────────────────────────────────────────────────────────────

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// ─── File transport (daily-rotated) ───────────────────────────────────────────

const logFilePath = getLogFilePath();
const logDir = path.dirname(logFilePath);
const logBaseName = path.basename(logFilePath, path.extname(logFilePath));

const fileTransport = new DailyRotateFile({
  dirname: logDir,
  filename: `${logBaseName}-%DATE%`,
  extension: path.extname(logFilePath) || ".log",
  datePattern: "YYYY-MM-DD",
  maxFiles: "30d",              // keep 30 days of logs
  maxSize: "20m",               // rotate at 20 MB
  format: jsonFormat,
});

// ─── Console transport (dev only) ─────────────────────────────────────────────

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
      const ctx = context ? ` [${context}]` : "";
      const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
      return `[${timestamp}] ${level}${ctx}: ${message}${extra}`;
    })
  ),
});

// ─── Winston instance ─────────────────────────────────────────────────────────

const winstonLogger = winston.createLogger({
  level: getLogLevel(),
  defaultMeta: {},
  transports: [
    fileTransport,
    ...(!isProduction() ? [consoleTransport] : []),
  ],
});

// ─── DB write helper (fire-and-forget) ────────────────────────────────────────

const writeToDatabase = (
  level: string,
  message: string,
  user: string,
  context?: string,
  meta?: Record<string, unknown>
): void => {
  // Intentionally not awaited — log persistence must never block the request.
  Log.create({
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
  private log(
    level: "info" | "warn" | "error" | "debug",
    message: string,
    context?: string,
    meta?: Record<string, unknown>,
    user: string = "system"
  ): void {
    winstonLogger.log({ level, message, context, user, ...meta });
    writeToDatabase(level, message, user, context, meta);
  }

  public info(message: string, context?: string, meta?: Record<string, unknown>, user: string = "system"): void {
    this.log("info", message, context, meta, user);
  }

  public warn(message: string, context?: string, meta?: Record<string, unknown>, user: string = "system"): void {
    this.log("warn", message, context, meta, user);
  }

  public error(message: string, context?: string, meta?: Record<string, unknown>, user: string = "system"): void {
    this.log("error", message, context, meta, user);
  }

  public debug(message: string, context?: string, meta?: Record<string, unknown>, user: string = "system"): void {
    this.log("debug", message, context, meta, user);
  }
}

export const logger = new LoggerService();
