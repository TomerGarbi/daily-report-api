/**
 * Seed the fully-populated sample report into MongoDB.
 *
 * Run with:
 *   npx ts-node scripts/seedSampleReport.ts
 *
 * Idempotent — upserts by title. Attaches the report to the first user found
 * with role "admin"; falls back to any user if no admin exists.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { Report } from "../models/Report";
import { User }   from "../models/User";
import { getMongoUri, getMongoDbName } from "../config/mongodbConfig";
import sampleReport from "./sampleReport";

const log = (msg: string) => console.log(`[seedSampleReport] ${msg}`);

async function run() {
  const uri    = getMongoUri();
  const dbName = getMongoDbName();
  log(`Connecting to MongoDB${dbName ? ` (${dbName})` : ""}...`);
  await mongoose.connect(uri, dbName ? { dbName } : undefined);
  log("Connected.");

  const author =
    (await User.findOne({ role: "admin" }).lean()) ??
    (await User.findOne().lean());

  if (!author) {
    throw new Error(
      "No users found in DB. Run `npx ts-node scripts/seed.ts` first to seed users.",
    );
  }

  const userRef = {
    username: author.username,
    userId:   author._id as mongoose.Types.ObjectId,
  };

  log(`Upserting report as "${userRef.username}"...`);

  const doc = await Report.findOneAndUpdate(
    { title: sampleReport.title },
    {
      $set: {
        description: sampleReport.description,
        content:     sampleReport.content,
        status:      sampleReport.status,
        updatedBy:   userRef,
      },
      $setOnInsert: {
        createdBy: userRef,
        version:   1,
      },
    },
    { upsert: true, returnDocument: "after", new: true },
  );

  log(`  ✓ Report "${sampleReport.title}" → ${doc?._id}`);
  log("Done.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[seedSampleReport] Fatal error:", err);
  mongoose.disconnect().finally(() => process.exit(1));
});
