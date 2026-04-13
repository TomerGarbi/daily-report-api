"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMongoDbName = exports.getMongoUri = void 0;
require("./env");
const getMongoUri = () => {
    const mongodbUri = process.env.MONGODB_URI;
    if (!mongodbUri) {
        throw new Error("Missing MONGODB_URI in environment variables");
    }
    return mongodbUri;
};
exports.getMongoUri = getMongoUri;
const getMongoDbName = () => process.env.MONGODB_DB_NAME;
exports.getMongoDbName = getMongoDbName;
//# sourceMappingURL=mongodbConfig.js.map