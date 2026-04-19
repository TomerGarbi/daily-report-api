"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const morgan_1 = __importDefault(require("morgan"));
const loggerService_1 = require("./services/loggerService");
const appConfig_1 = require("./config/appConfig");
const sanitize_1 = require("./middleware/sanitize");
const errorHandler_1 = require("./middleware/errorHandler");
const authRoute_1 = __importDefault(require("./routes/authRoute"));
const reportRoute_1 = __importDefault(require("./routes/reportRoute"));
const userRoute_1 = __importDefault(require("./routes/userRoute"));
const logRoute_1 = __importDefault(require("./routes/logRoute"));
// Ensure all Mongoose models are registered before any route handler runs.
// Without explicit imports here, a model referenced only via `populate()`
// may not yet be registered if its file hasn't been loaded.
require("./models/User");
require("./models/Group");
require("./models/Report");
require("./models/Log");
const app = (0, express_1.default)();
// CORS — must be registered before helmet so preflight (OPTIONS) responses
// are sent without restrictive security headers blocking them.
app.use((0, cors_1.default)({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
// Security middleware — configured to not conflict with CORS
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
}));
// Cookie parsing (must be before routes)
app.use((0, cookie_parser_1.default)());
// Body parsing
app.use(express_1.default.json({ limit: "1mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "1mb" }));
// Input sanitization & injection / XSS / JSFuck / harmful-content guards
// Only applied to mutation routes — GET / HEAD / OPTIONS don't carry harmful payloads
// and scanning every read request is wasteful.
app.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method))
        return next();
    // sanitizeRequest is an array of middleware — run them in sequence
    let idx = 0;
    const run = () => {
        if (idx >= sanitize_1.sanitizeRequest.length)
            return next();
        sanitize_1.sanitizeRequest[idx++](req, res, run);
    };
    run();
});
// HTTP request logging with Morgan
if ((0, appConfig_1.isDevelopment)()) {
    app.use((0, morgan_1.default)("dev"));
}
// Health check endpoint
app.get("/health", (req, res) => {
    loggerService_1.logger.info("Health check requested", "HealthCheck");
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});
// Root endpoint
app.get("/", (req, res) => {
    res.status(200).json({ message: "Daily Report API", version: "1.0.0" });
});
// Routes
app.use("/api/v1/auth", authRoute_1.default);
app.use("/api/v1/reports", reportRoute_1.default);
app.use("/api/v1/users", userRoute_1.default);
app.use("/api/v1/logs", logRoute_1.default);
// 404 — must be after all routes
app.use(errorHandler_1.notFoundHandler);
// Global error handler — must be last
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map