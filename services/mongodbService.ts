import mongoose from "mongoose";
import { getMongoDbName, getMongoUri } from "../config/mongodbConfig";
import { logger } from "./loggerService";

export const connectToDatabase = async (): Promise<void> => {
  try {
    const mongoUri = getMongoUri();
    const dbName = getMongoDbName();

    logger.info("Attempting to connect to MongoDB", "MongoDBService", {
      dbName: dbName || "default",
    });

    const connectionOptions = dbName ? { dbName } : undefined;

    await mongoose.connect(mongoUri, connectionOptions);

    logger.info("Successfully connected to MongoDB", "MongoDBService", {
      dbName: dbName || "default",
      host: mongoose.connection.host,
    });
  } catch (error) {
    logger.error("Failed to connect to MongoDB", "MongoDBService", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
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
