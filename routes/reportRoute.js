"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = require("../middleware/asyncHandler");
const authenticate_1 = require("../middleware/authenticate");
const authorize_1 = require("../middleware/authorize");
const validate_1 = require("../middleware/validate");
const policies_1 = require("../middleware/policies");
const reportSchemas_1 = require("../schemas/reportSchemas");
const reportController_1 = require("../controllers/reportController");
const router = (0, express_1.Router)();
// All report routes require authentication
router.use(authenticate_1.authenticate);
router.post("/", (0, authorize_1.authorize)(policies_1.POLICIES.createReport), (0, validate_1.validate)(reportSchemas_1.createReportSchema), (0, asyncHandler_1.asyncHandler)(reportController_1.createReportHandler));
router.get("/", (0, authorize_1.authorize)(policies_1.POLICIES.viewReports), (0, validate_1.validate)(reportSchemas_1.listReportsSchema, "query"), (0, asyncHandler_1.asyncHandler)(reportController_1.listReportsHandler));
router.get("/stats", (0, authorize_1.authorize)(policies_1.POLICIES.viewReports), (0, asyncHandler_1.asyncHandler)(reportController_1.statsReportHandler));
router.get("/:id", (0, authorize_1.authorize)(policies_1.POLICIES.viewReports), (0, asyncHandler_1.asyncHandler)(reportController_1.getReportHandler));
router.patch("/:id", (0, authorize_1.authorize)(policies_1.POLICIES.createReport), (0, validate_1.validate)(reportSchemas_1.updateReportSchema), (0, asyncHandler_1.asyncHandler)(reportController_1.updateReportHandler));
router.delete("/:id", (0, authorize_1.authorize)(policies_1.POLICIES.deleteReport), (0, asyncHandler_1.asyncHandler)(reportController_1.deleteReportHandler));
exports.default = router;
//# sourceMappingURL=reportRoute.js.map