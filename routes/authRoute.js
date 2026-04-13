"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = require("../middleware/asyncHandler");
const authenticate_1 = require("../middleware/authenticate");
const validate_1 = require("../middleware/validate");
const rateLimiter_1 = require("../middleware/rateLimiter");
const authSchemas_1 = require("../schemas/authSchemas");
const authController_1 = require("../controllers/authController");
const router = (0, express_1.Router)();
router.post("/login", rateLimiter_1.authIpLimiter, rateLimiter_1.authUsernameLimiter, (0, validate_1.validate)(authSchemas_1.loginSchema), (0, asyncHandler_1.asyncHandler)(authController_1.loginHandler));
router.post("/refresh", rateLimiter_1.refreshRateLimiter, (0, asyncHandler_1.asyncHandler)(authController_1.refreshHandler));
router.post("/logout", authenticate_1.authenticate, (0, asyncHandler_1.asyncHandler)(authController_1.logoutHandler));
router.get("/me", authenticate_1.authenticate, (0, asyncHandler_1.asyncHandler)(authController_1.meHandler));
exports.default = router;
//# sourceMappingURL=authRoute.js.map