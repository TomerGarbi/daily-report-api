"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, "../.env.local") });
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = require("../models/User");
const Group_1 = require("../models/Group");
(async () => {
    await mongoose_1.default.connect(process.env.MONGODB_URI, {
        ...(process.env.MONGODB_DB_NAME ? { dbName: process.env.MONGODB_DB_NAME } : {}),
    });
    const db = mongoose_1.default.connection.db;
    const collections = (await db.listCollections().toArray()).map((c) => c.name);
    const users = await User_1.User.find({}).lean();
    const groups = await Group_1.Group.find({}).lean();
    console.log("Database   :", db.databaseName);
    console.log("Collections:", collections.join(", "));
    console.log(`\nUsers (${users.length}):`);
    users.forEach((u) => console.log(`  - ${u.username}  role=${u.role}  _id=${u._id}`));
    console.log(`\nGroups (${groups.length}):`);
    groups.forEach((g) => console.log(`  - ${g.name}  _id=${g._id}`));
    await mongoose_1.default.disconnect();
})();
//# sourceMappingURL=checkDb.js.map