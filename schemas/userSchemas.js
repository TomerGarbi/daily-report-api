"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSchema = exports.listUsersSchema = void 0;
const zod_1 = require("zod");
const auth_1 = require("../types/auth");
const objectId = zod_1.z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Must be a valid ObjectId");
// ─── List query ───────────────────────────────────────────────────────────────
exports.listUsersSchema = zod_1.z.object({
    role: zod_1.z.enum(auth_1.ROLE_HIERARCHY).optional(),
    group: objectId.optional(),
    search: zod_1.z.string().max(100).optional(), // partial username match
    page: zod_1.z.coerce.number().int().min(1).optional().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional().default(20),
});
// ─── Update ───────────────────────────────────────────────────────────────────
exports.updateUserSchema = zod_1.z.object({
    role: zod_1.z.enum(auth_1.ROLE_HIERARCHY).optional(),
    groups: zod_1.z.array(objectId).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided for update" });
//# sourceMappingURL=userSchemas.js.map