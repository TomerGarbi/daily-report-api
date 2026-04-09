import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import mongoose from "mongoose";
import { User } from "../models/User";
import { Group } from "../models/Group";

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!, {
    ...(process.env.MONGODB_DB_NAME ? { dbName: process.env.MONGODB_DB_NAME } : {}),
  });

  const db = mongoose.connection.db!;
  const collections = (await db.listCollections().toArray()).map((c) => c.name);

  const users  = await User.find({}).lean();
  const groups = await Group.find({}).lean();

  console.log("Database   :", db.databaseName);
  console.log("Collections:", collections.join(", "));
  console.log(`\nUsers (${users.length}):`);
  users.forEach((u: any) => console.log(`  - ${u.username}  role=${u.role}  _id=${u._id}`));
  console.log(`\nGroups (${groups.length}):`);
  groups.forEach((g: any) => console.log(`  - ${g.name}  _id=${g._id}`));

  await mongoose.disconnect();
})();
