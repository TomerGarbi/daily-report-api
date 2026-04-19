"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listLogsSchema = void 0;
const zod_1 = require("zod");
// ─── List query ───────────────────────────────────────────────────────────────
const isoDate = zod_1.z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/, "Must be an ISO 8601 date (YYYY-MM-DD or full ISO)");
exports.listLogsSchema = zod_1.z.object({
    level: zod_1.z.enum(["info", "warn", "error", "debug"]).optional(),
    user: zod_1.z.string().max(100).optional(),
    context: zod_1.z.string().max(200).optional(),
    search: zod_1.z.string().max(200).optional(), // message substring
    from: isoDate.optional(), // logs on or after this timestamp
    to: isoDate.optional(), // logs on or before this timestamp
    page: zod_1.z.coerce.number().int().min(1).optional().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional().default(50),
});
//# sourceMappingURL=logSchemas.js.map