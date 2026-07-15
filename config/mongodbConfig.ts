import "./env";
import type { ConnectOptions } from "mongoose";

export const getMongoUri = (): string => {
  const mongodbUri = process.env.MONGODB_URI;

  if (!mongodbUri) {
    throw new Error("Missing MONGODB_URI in environment variables");
  }

  return mongodbUri;
};

export const getMongoDbName = (): string | undefined => process.env.MONGODB_DB_NAME;

/**
 * Startup-retry configuration for the initial MongoDB connection.
 * Reads env with sensible defaults so the app doesn't crash if Mongo is
 * still coming up (common in docker-compose / kubernetes cold-starts).
 */
export const getMongoStartupRetry = (): { maxAttempts: number; initialBackoffMs: number } => ({
  maxAttempts: Number(process.env.MONGODB_STARTUP_MAX_ATTEMPTS) || 10,
  initialBackoffMs: Number(process.env.MONGODB_STARTUP_BACKOFF_MS) || 1000,
});

/**
 * Mongoose connect options. Pool sizes and timeouts are tunable via env so
 * ops can adjust without a code change. All values have production-safe
 * defaults.
 */
export const getMongoConnectOptions = (): ConnectOptions => {
  const dbName = getMongoDbName();
  const options: ConnectOptions = {
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 10_000,
    socketTimeoutMS: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS) || 45_000,
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE) || 20,
    minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE) || 2,
    heartbeatFrequencyMS: Number(process.env.MONGODB_HEARTBEAT_MS) || 10_000,
  };
  if (dbName) options.dbName = dbName;
  return options;
};
