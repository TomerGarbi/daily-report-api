import type { Server } from "http";
import app from "./app";
import { getPort } from "./config/appConfig";
import { connectToDatabase, disconnectFromDatabase } from "./services/mongodbService";
import { disconnectMssql } from "./services/mssqlService";
import { logger } from "./services/loggerService";
import { reportException } from "./services/errorReporter";

/** Milliseconds we wait for in-flight requests to finish before force-exit. */
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 20_000;

/**
 * Held after `app.listen()` succeeds so the shutdown handlers can call
 * `server.close()` without needing to plumb the reference around.
 */
let httpServer: Server | null = null;

/** Prevent re-entry when multiple signals arrive during shutdown. */
let shuttingDown = false;

/**
 * Best-effort graceful shutdown:
 *   1. Stop accepting new HTTP connections.
 *   2. Wait for in-flight requests to finish (bounded by SHUTDOWN_TIMEOUT_MS).
 *   3. Close DB connections.
 *   4. Exit.
 *
 * If anything hangs past the timeout, we force-exit so orchestrators
 * (systemd / docker / k8s) can start a fresh instance.
 */
const gracefulShutdown = async (signal: string, exitCode: number = 0): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`Received ${signal}, starting graceful shutdown`, "Application", {
    timeoutMs: SHUTDOWN_TIMEOUT_MS,
  });

  const forceExit = setTimeout(() => {
    logger.error(
      `Graceful shutdown exceeded ${SHUTDOWN_TIMEOUT_MS}ms — forcing exit`,
      "Application",
    );
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  // Don't let the force-exit timer keep the process alive on its own.
  forceExit.unref();

  try {
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info("HTTP server closed", "Application");
    }
  } catch (err) {
    logger.error("Error closing HTTP server", "Application", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Close dependencies in parallel — they don't depend on each other.
  const dbResults = await Promise.allSettled([
    disconnectFromDatabase(),
    disconnectMssql(),
  ]);
  for (const r of dbResults) {
    if (r.status === "rejected") {
      logger.error("Error during dependency shutdown", "Application", {
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  }

  clearTimeout(forceExit);
  logger.info("Graceful shutdown complete", "Application", { exitCode });
  process.exit(exitCode);
};

const startServer = async (): Promise<void> => {
  try {
    const port = getPort();

    logger.info("Starting application", "Application");
    await connectToDatabase();

    httpServer = app.listen(port, () => {
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

// Handle unhandled promise rejections — treat as fatal but shut down cleanly.
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection", "Application", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  reportException(reason, { tags: { origin: "unhandledRejection" } });
  void gracefulShutdown("unhandledRejection", 1);
});

// Handle uncaught exceptions — also fatal, but flush logs and drain first.
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", "Application", {
    error: error.message,
    stack: error.stack,
  });
  reportException(error, { tags: { origin: "uncaughtException" } });
  void gracefulShutdown("uncaughtException", 1);
});

// OS-level shutdown signals (docker stop, systemctl stop, Ctrl-C).
process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

// Start the server
startServer();
