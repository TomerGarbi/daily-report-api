"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = require("../middleware/asyncHandler");
const authenticate_1 = require("../middleware/authenticate");
const authorize_1 = require("../middleware/authorize");
const validate_1 = require("../middleware/validate");
const policies_1 = require("../middleware/policies");
const logSchemas_1 = require("../schemas/logSchemas");
const logController_1 = require("../controllers/logController");
const router = (0, express_1.Router)();
// All log routes require authentication
router.use(authenticate_1.authenticate);
router.get("/", (0, authorize_1.authorize)(policies_1.POLICIES.viewLogs), (0, validate_1.validate)(logSchemas_1.listLogsSchema, "query"), (0, asyncHandler_1.asyncHandler)(logController_1.listLogsHandler));
router.get("/stats", (0, authorize_1.authorize)(policies_1.POLICIES.viewLogs), (0, asyncHandler_1.asyncHandler)(logController_1.statsLogsHandler));
router.get("/:id", (0, authorize_1.authorize)(policies_1.POLICIES.viewLogs), (0, asyncHandler_1.asyncHandler)(logController_1.getLogHandler));
exports.default = router;
//# sourceMappingURL=logRoute.js.map