"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const appConfig_1 = require("../config/appConfig");
/**
 * Validates a part of the request against a Zod schema.
 * On success, replaces the request part with the parsed (typed) data.
 * On failure, responds with 400 and the list of validation errors.
 */
const validate = (schema, part = "body") => {
    return (req, res, next) => {
        const result = schema.safeParse(req[part]);
        if (!result.success) {
            const errors = result.error.issues.map((e) => {
                const base = {
                    field: e.path.join("."),
                    message: e.message,
                };
                if ((0, appConfig_1.isDevelopment)()) {
                    base["code"] = e.code;
                    if ("expected" in e)
                        base["expected"] = e.expected;
                    if ("received" in e)
                        base["received"] = e.received;
                }
                return base;
            });
            res.status(400).json({
                status: 400,
                message: "Validation failed",
                errors,
                ...((0, appConfig_1.isDevelopment)() ? { received: req[part] } : {}),
            });
            return;
        }
        // Replace with parsed data so downstream handlers get typed, coerced values.
        // Express 5: req.query is a read-only getter — mutate in-place instead of reassigning.
        if (part === "query") {
            const q = req.query;
            for (const key of Object.keys(q))
                delete q[key];
            Object.assign(q, result.data);
        }
        else {
            req[part] = result.data;
        }
        next();
    };
};
exports.validate = validate;
//# sourceMappingURL=validate.js.map