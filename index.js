"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const appConfig_1 = require("./config/appConfig");
const mongodbService_1 = require("./services/mongodbService");
const loggerService_1 = require("./services/loggerService");
const startServer = async () => {
    try {
        const port = (0, appConfig_1.getPort)();
        // Connect to database
        loggerService_1.logger.info("Starting application", "Application");
        await (0, mongodbService_1.connectToDatabase)();
        // Start the server
        app_1.default.listen(port, () => {
            loggerService_1.logger.info(`Server is running on port ${port}`, "Application", {
                port,
                nodeEnv: process.env.NODE_ENV,
            });
        });
    }
    catch (error) {
        loggerService_1.logger.error("Failed to start application", "Application", {
            error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
    }
};
// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
    loggerService_1.logger.error("Unhandled Rejection", "Application", {
        reason: String(reason),
    });
    process.exit(1);
});
// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
    loggerService_1.logger.error("Uncaught Exception", "Application", {
        error: error.message,
        stack: error.stack,
    });
    process.exit(1);
});
// Start the server
startServer();
//# sourceMappingURL=index.js.map