import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { logger } from "./services/loggerService";
import { isDevelopment } from "./config/appConfig";
import { sanitizeRequest } from "./middleware/sanitize";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";
import authRoute from "./routes/authRoute";
import reportRoute from "./routes/reportRoute";
import userRoute from "./routes/userRoute";

// Ensure all Mongoose models are registered before any route handler runs.
// Without explicit imports here, a model referenced only via `populate()`
// may not yet be registered if its file hasn't been loaded.
import "./models/User";
import "./models/Group";
import "./models/Report";
import "./models/Log";

const app: Application = express();

// CORS — must be registered before helmet so preflight (OPTIONS) responses
// are sent without restrictive security headers blocking them.
const allowedOrigin = process.env.CLIENT_URL ?? "http://localhost:3000";
app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
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

// Input sanitization & injection / XSS / JSFuck / harmful-content guards
// Only applied to mutation routes — GET / HEAD / OPTIONS don't carry harmful payloads
// and scanning every read request is wasteful.
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  // sanitizeRequest is an array of middleware — run them in sequence
  let idx = 0;
  const run = (): void => {
    if (idx >= sanitizeRequest.length) return next();
    sanitizeRequest[idx++]!(req, res, run);
  };
  run();
});

// HTTP request logging with Morgan
if (isDevelopment()) {
  app.use(morgan("dev"));
}

// Health check endpoint
app.get("/health", (req, res) => {
  logger.info("Health check requested", "HealthCheck");
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({ message: "Daily Report API", version: "1.0.0" });
});

// Routes
app.use("/api/v1/auth",    authRoute);
app.use("/api/v1/reports", reportRoute);
app.use("/api/v1/users",   userRoute);

// 404 — must be after all routes
app.use(notFoundHandler);

// Global error handler — must be last
app.use(errorHandler);

export default app;
