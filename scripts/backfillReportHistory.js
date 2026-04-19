"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const mongoose_1 = __importDefault(require("mongoose"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, "../.env.local") });
const mongodbConfig_1 = require("../config/mongodbConfig");
const Report_1 = require("../models/Report");
const DAYS_TO_BACKFILL = 60;
const TITLE_MARKER = "[history-sample:";
const log = (message) => {
    console.log(`[backfill-report-history] ${message}`);
};
const formatDay = (date) => date.toISOString().slice(0, 10);
const buildTimestamp = (baseDate, sourceIndex) => {
    const hour = 9 + (sourceIndex % 8);
    const minute = (sourceIndex * 11) % 60;
    return new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), hour, minute, 0, 0));
};
const buildGeneratedTitle = (title, dayKey) => {
    return `${title} ${TITLE_MARKER}${dayKey}]`;
};
const buildGeneratedContent = (source, dayKey) => ({
    ...source.content,
    _historySample: {
        sourceReportId: source._id.toString(),
        generatedForDate: dayKey,
    },
});
const run = async () => {
    const mongoDbName = (0, mongodbConfig_1.getMongoDbName)();
    const connectionOptions = mongoDbName ? { dbName: mongoDbName } : undefined;
    await mongoose_1.default.connect((0, mongodbConfig_1.getMongoUri)(), connectionOptions);
    const sourceReports = await Report_1.Report.find({
        title: { $not: new RegExp(`\\${TITLE_MARKER}`) },
    })
        .sort({ createdAt: -1 })
        .lean();
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
        const source = sourceReports[index % sourceReports.length];
        const timestamp = buildTimestamp(baseDate, index);
        const title = buildGeneratedTitle(source.title, dayKey);
        const existing = await Report_1.Report.exists({ title });
        await Report_1.Report.findOneAndUpdate({ title }, {
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
        }, {
            upsert: true,
            returnDocument: "after",
            timestamps: false,
        });
        if (existing) {
            updatedCount += 1;
        }
        else {
            createdCount += 1;
        }
    }
    log(`Source reports used: ${sourceReports.length}`);
    log(`Historical reports created: ${createdCount}`);
    log(`Historical reports refreshed: ${updatedCount}`);
    await mongoose_1.default.disconnect();
};
run().catch((error) => {
    console.error("[backfill-report-history] Fatal error:", error);
    mongoose_1.default.disconnect().finally(() => process.exit(1));
});
//# sourceMappingURL=backfillReportHistory.js.map