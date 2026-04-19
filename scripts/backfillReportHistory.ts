import dotenv from "dotenv";
import path from "path";
import mongoose, { Types } from "mongoose";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { getMongoDbName, getMongoUri } from "../config/mongodbConfig";
import { Report } from "../models/Report";

const DAYS_TO_BACKFILL = 60;
const TITLE_MARKER = "[history-sample:";

type SourceReport = {
  _id: Types.ObjectId;
  title: string;
  description: string;
  content: Record<string, unknown>;
  status: "draft" | "published";
  createdBy: {
    username: string;
    userId: Types.ObjectId;
  };
  updatedBy: {
    username: string;
    userId: Types.ObjectId;
  };
};

const log = (message: string): void => {
  console.log(`[backfill-report-history] ${message}`);
};

const formatDay = (date: Date): string => date.toISOString().slice(0, 10);

const buildTimestamp = (baseDate: Date, sourceIndex: number): Date => {
  const hour = 9 + (sourceIndex % 8);
  const minute = (sourceIndex * 11) % 60;

  return new Date(Date.UTC(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate(),
    hour,
    minute,
    0,
    0
  ));
};

const buildGeneratedTitle = (title: string, dayKey: string): string => {
  return `${title} ${TITLE_MARKER}${dayKey}]`;
};

const buildGeneratedContent = (source: SourceReport, dayKey: string): Record<string, unknown> => ({
  ...source.content,
  _historySample: {
    sourceReportId: source._id.toString(),
    generatedForDate: dayKey,
  },
});

const run = async (): Promise<void> => {
  const mongoDbName = getMongoDbName();
  const connectionOptions = mongoDbName ? { dbName: mongoDbName } : undefined;

  await mongoose.connect(getMongoUri(), connectionOptions);

  const sourceReports = await Report.find({
    title: { $not: new RegExp(`\\${TITLE_MARKER}`) },
  })
    .sort({ createdAt: -1 })
    .lean<SourceReport[]>();

  if (sourceReports.length === 0) {
    throw new Error("No source reports found in the database to clone");
  }

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (DAYS_TO_BACKFILL - 1));

  let createdCount = 0;
  let updatedCount = 0;

  for (let index = 0; index < DAYS_TO_BACKFILL; index += 1) {
    const baseDate = new Date(start);
    baseDate.setUTCDate(start.getUTCDate() + index);

    const dayKey = formatDay(baseDate);
    const source = sourceReports[index % sourceReports.length]!;
    const timestamp = buildTimestamp(baseDate, index);
    const title = buildGeneratedTitle(source.title, dayKey);
    const existing = await Report.exists({ title });

    await Report.findOneAndUpdate(
      { title },
      {
        $set: {
          description: `${source.description} Historical sample for ${dayKey}.`,
          content: buildGeneratedContent(source, dayKey),
          status: source.status,
          updatedBy: source.updatedBy,
          updatedAt: timestamp,
        },
        $setOnInsert: {
          title,
          createdBy: source.createdBy,
          version: 1,
          createdAt: timestamp,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        timestamps: false,
      }
    );

    if (existing) {
      updatedCount += 1;
    } else {
      createdCount += 1;
    }
  }

  log(`Source reports used: ${sourceReports.length}`);
  log(`Historical reports created: ${createdCount}`);
  log(`Historical reports refreshed: ${updatedCount}`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("[backfill-report-history] Fatal error:", error);
  mongoose.disconnect().finally(() => process.exit(1));
});