/**
 * backfillUserActivity
 * -----------------------------------------------------------------------------
 * One-shot migration script: seeds `lastActivityAt` (and, where possible,
 * `lastLoginAt`) on User documents that predate the Phase-A1 schema change.
 *
 * Strategy — for each user with `lastActivityAt` missing, look up the most
 * recent log entry authored by that user in the `logs` collection and use
 * its timestamp. This gives dashboards a plausible "seen at" value on
 * day-one instead of showing every legacy account as "never logged in".
 *
 * Usage:
 *   ts-node scripts/backfillUserActivity.ts
 *   ts-node scripts/backfillUserActivity.ts --dry-run
 */

import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { getMongoDbName, getMongoUri } from "../config/mongodbConfig";
import { User } from "../models/User";
import { Log } from "../models/Log";

const DRY_RUN = process.argv.includes("--dry-run");

const log = (message: string): void => {
  console.log(`[backfill-user-activity] ${message}`);
};

async function main(): Promise<void> {
  log(`Connecting to Mongo (${getMongoDbName()})…`);
  const dbName = getMongoDbName();
  const connectOpts = dbName ? { dbName } : {};
  await mongoose.connect(getMongoUri(), connectOpts);

  // Only touch documents that don't already have activity data — this makes
  // the script idempotent and safe to re-run.
  const candidates = await User.find(
    {
      $or: [
        { lastActivityAt: { $exists: false } },
        { lastActivityAt: null },
      ],
    },
    { username: 1, lastLoginAt: 1 },
  ).lean();

  log(`Found ${candidates.length} user(s) needing backfill${DRY_RUN ? " (dry run)" : ""}.`);

  let updated = 0;
  let skipped = 0;

  for (const user of candidates) {
    // Most recent log written by (or about) this user.
    const latest = await Log.findOne({ user: user.username }, { timestamp: 1 })
      .sort({ timestamp: -1 })
      .lean();

    if (!latest) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      log(`  would set ${user.username} → ${latest.timestamp.toISOString()}`);
      updated++;
      continue;
    }

    // Fill lastActivityAt; also fill lastLoginAt if it's blank so the admin
    // UI can differentiate "never logged in" from "very old user".
    const set: Record<string, Date> = { lastActivityAt: latest.timestamp };
    if (!user.lastLoginAt) set["lastLoginAt"] = latest.timestamp;

    await User.updateOne({ _id: user._id }, { $set: set });
    updated++;
  }

  log(`Done. updated=${updated} skipped=${skipped}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[backfill-user-activity] fatal:", err);
  process.exit(1);
});
