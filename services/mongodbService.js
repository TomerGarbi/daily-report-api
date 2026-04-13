"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectFromDatabase = exports.connectToDatabase = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const mongodbConfig_1 = require("../config/mongodbConfig");
const loggerService_1 = require("./loggerService");
const connectToDatabase = async () => {
    try {
        const mongoUri = (0, mongodbConfig_1.getMongoUri)();
        const dbName = (0, mongodbConfig_1.getMongoDbName)();
        loggerService_1.logger.info("Attempting to connect to MongoDB", "MongoDBService", {
            dbName: dbName || "default",
        });
        const connectionOptions = dbName ? { dbName } : undefined;
        await mongoose_1.default.connect(mongoUri, connectionOptions);
        loggerService_1.logger.info("Successfully connected to MongoDB", "MongoDBService", {
            dbName: dbName || "default",
            host: mongoose_1.default.connection.host,
        });
    }
    catch (error) {
        loggerService_1.logger.error("Failed to connect to MongoDB", "MongoDBService", {
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
};
exports.connectToDatabase = connectToDatabase;
const disconnectFromDatabase = async () => {
    try {
        loggerService_1.logger.info("Disconnecting from MongoDB", "MongoDBService");
        await mongoose_1.default.disconnect();
        loggerService_1.logger.info("Successfully disconnected from MongoDB", "MongoDBService");
    }
    catch (error) {
        loggerService_1.logger.error("Failed to disconnect from MongoDB", "MongoDBService", {
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
};
exports.disconnectFromDatabase = disconnectFromDatabase;
//# sourceMappingURL=mongodbService.js.map