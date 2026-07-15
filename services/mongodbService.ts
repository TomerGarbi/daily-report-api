import mongoose from "mongoose";
import {
  getMongoConnectOptions,
  getMongoDbName,
  getMongoStartupRetry,
  getMongoUri,
} from "../config/mongodbConfig";
import { logger } from "./loggerService";

let connectionEventsWired = false;

/**
 * Subscribe once to mongoose connection lifecycle events for structured
 * logging. Called from `connectToDatabase` to guarantee it runs even in
 * tests that boot a fresh mongoose instance.
 */
const wireConnectionEvents = (): void => {
  if (connectionEventsWired) return;
  connectionEventsWired = true;

  const conn = mongoose.connection;

  conn.on("disconnected", () => {
    logger.warn("MongoDB disconnected", "MongoDBService");
  });
  conn.on("reconnected", () => {
    logger.info("MongoDB reconnected", "MongoDBService", {
      host: conn.host,
    });
  });
  conn.on("error", (err: unknown) => {
    logger.error("MongoDB connection error", "MongoDBService", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const connectToDatabase = async (): Promise<void> => {
  const mongoUri = getMongoUri();
  const dbName = getMongoDbName();
  const options = getMongoConnectOptions();
  const { maxAttempts, initialBackoffMs } = getMongoStartupRetry();

  wireConnectionEvents();

  logger.info("Attempting to connect to MongoDB", "MongoDBService", {
    dbName: dbName || "default",
    maxAttempts,
  });

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await mongoose.connect(mongoUri, options);
      logger.info("Successfully connected to MongoDB", "MongoDBService", {
        dbName: dbName || "default",
        host: mongoose.connection.host,
        attempt,
      });
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= maxAttempts) break;

      const delay = Math.min(initialBackoffMs * 2 ** (attempt - 1), 30_000);
      logger.warn(
        `MongoDB connect attempt ${attempt}/${maxAttempts} failed; retrying in ${delay}ms`,
        "MongoDBService",
        { error: message },
      );
      await sleep(delay);
    }
  }

  logger.error("Failed to connect to MongoDB after all retries", "MongoDBService", {
    error: lastError instanceof Error ? lastError.message : String(lastError),
    attempts: maxAttempts,
  });
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

export const disconnectFromDatabase = async (): Promise<void> => {
  try {
    logger.info("Disconnecting from MongoDB", "MongoDBService");
    await mongoose.disconnect();
    logger.info("Successfully disconnected from MongoDB", "MongoDBService");
  } catch (error) {
    logger.error("Failed to disconnect from MongoDB", "MongoDBService", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
