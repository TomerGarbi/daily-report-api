"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutSchema = exports.refreshSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1, "Username is required"),
    password: zod_1.z.string().min(1, "Password is required"),
});
// Refresh and logout no longer carry the token in the body —
// it arrives via the HttpOnly cookie instead.
exports.refreshSchema = zod_1.z.object({});
exports.logoutSchema = zod_1.z.object({});
//# sourceMappingURL=authSchemas.js.map