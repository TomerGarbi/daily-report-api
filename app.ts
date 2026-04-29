import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import mongoose from "mongoose";
import { getCorsOrigin, isDevelopment } from "./config/appConfig";
import { sanitizeRequest } from "./middleware/sanitize";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";
import { requestId } from "./middleware/requestId";
import { requestLogger } from "./middleware/requestLogger";
import { defaultRateLimiter } from "./middleware/rateLimiter";
import authRoute from "./routes/authRoute";
import reportRoute from "./routes/reportRoute";
import userRoute from "./routes/userRoute";
import logRoute from "./routes/logRoute";
import stationRoute from "./routes/stationRoute";
import weatherRoute from "./routes/weatherRoute";

// Ensure all Mongoose models are registered before any route handler runs.
// Without explicit imports here, a model referenced only via `populate()`
// may not yet be registered if its file hasn't been loaded.
import "./models/User";
import "./models/Group";
import "./models/Report";
import "./models/Log";
import "./models/Station";
import "./models/Weather";

const app: Application = express();

// Trust the first proxy hop so rate-limit / req.ip use X-Forwarded-For correctly
// when running behind a reverse proxy (nginx, ingress, etc.).
app.set("trust proxy", 1);

// Request id — must be first so every downstream log line and error response
// can carry the same correlation id.
app.use(requestId);

// CORS — must be registered before helmet so preflight (OPTIONS) responses
// are sent without restrictive security headers blocking them.
app.use(
  cors({
    origin: getCorsOrigin(),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
  })
);

// Security middleware — configured to not conflict with CORS
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
  })
);

// Cookie parsing (must be before routes)
app.use(cookieParser());

// Body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Input sanitization & injection / XSS / JSFuck / harmful-content guards.
// Applied to ALL methods so query-string / param payloads are scanned on GETs too.
app.use((req, res, next) => {
  let idx = 0;
  const run = (): void => {
    if (idx >= sanitizeRequest.length) return next();
    sanitizeRequest[idx++]!(req, res, run);
  };
  run();
});

// HTTP request logging with Morgan (skip health checks)
if (isDevelopment()) {
  app.use(morgan("dev", {
    skip: (req) => req.url === "/health",
  }));
}

// Structured per-request logger (production-friendly; logs after response)
app.use(requestLogger);

// Health check endpoint — unauthenticated, never rate-limited.
// Reports DB connection state so container probes can detect dependency outages.
app.get("/health", (_req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  const healthy = dbState === 1;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    database: {
      state: dbState,
      connected: healthy,
    },
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({ message: "Daily Report API", version: "1.0.0" });
});

// Apply the default rate limiter to all API endpoints.
// Auth-specific limiters are still mounted inside authRoute.
app.use("/api/v1", defaultRateLimiter);

// Routes
app.use("/api/v1/auth",     authRoute);
app.use("/api/v1/reports",  reportRoute);
app.use("/api/v1/users",    userRoute);
app.use("/api/v1/logs",     logRoute);
app.use("/api/v1/stations", stationRoute);
app.use("/api/v1/weather",  weatherRoute);

// 404 — must be after all routes
app.use(notFoundHandler);

// Global error handler — must be last
app.use(errorHandler);

export default app;
