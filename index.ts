import app from "./app";
import { getPort } from "./config/appConfig";
import { connectToDatabase } from "./services/mongodbService";
import { logger } from "./services/loggerService";

const startServer = async (): Promise<void> => {
  try {
    const port = getPort();

    // Connect to database
    logger.info("Starting application", "Application");
    await connectToDatabase();

    // Start the server
    app.listen(port, () => {
      logger.info(`Server is running on port ${port}`, "Application", {
        port,
        nodeEnv: process.env.NODE_ENV,
      });
    });
  } catch (error) {
    logger.error("Failed to start application", "Application", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", "Application", {
    reason: String(reason),
  });
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", "Application", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Start the server
startServer();
