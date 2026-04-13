"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listReportsSchema = exports.updateReportSchema = exports.createReportSchema = void 0;
const zod_1 = require("zod");
// ─── Create ───────────────────────────────────────────────────────────────────
exports.createReportSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Title is required").max(200),
    description: zod_1.z.string().min(1, "Description is required").max(500),
    content: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional().default({}),
    status: zod_1.z.enum(["draft", "published"]).optional().default("published"),
});
// ─── Update ───────────────────────────────────────────────────────────────────
exports.updateReportSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional(),
    description: zod_1.z.string().min(1).max(500).optional(),
    content: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    status: zod_1.z.enum(["draft", "published"]).optional().default("published"),
}).refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided for update" });
// ─── List query ───────────────────────────────────────────────────────────────
const isoDate = zod_1.z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/, "Must be an ISO 8601 date (YYYY-MM-DD or full ISO)");
exports.listReportsSchema = zod_1.z.object({
    status: zod_1.z.enum(["draft", "published"]).optional(),
    search: zod_1.z.string().max(200).optional(), // title substring
    author: zod_1.z.string().max(100).optional(), // createdBy.username substring
    createdAfter: isoDate.optional(), // reports created on or after this date
    createdBefore: isoDate.optional(), // reports created on or before this date
    page: zod_1.z.coerce.number().int().min(1).optional().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional().default(20),
});
//# sourceMappingURL=reportSchemas.js.map