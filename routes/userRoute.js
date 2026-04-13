"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = require("../middleware/asyncHandler");
const authenticate_1 = require("../middleware/authenticate");
const authorize_1 = require("../middleware/authorize");
const validate_1 = require("../middleware/validate");
const policies_1 = require("../middleware/policies");
const userSchemas_1 = require("../schemas/userSchemas");
const userController_1 = require("../controllers/userController");
const router = (0, express_1.Router)();
// All user-management routes require authentication
router.use(authenticate_1.authenticate);
// GET  /users        — managers, admins, HR, IT-Admins
// GET  /users/:id    — same
// PATCH /users/:id   — admins, IT-Admins only
// DELETE /users/:id  — admins, IT-Admins only
router.get("/stats", (0, authorize_1.authorize)(policies_1.POLICIES.viewUsers), (0, asyncHandler_1.asyncHandler)(userController_1.statsUserHandler));
router.get("/", (0, authorize_1.authorize)(policies_1.POLICIES.viewUsers), (0, validate_1.validate)(userSchemas_1.listUsersSchema, "query"), (0, asyncHandler_1.asyncHandler)(userController_1.listUsersHandler));
router.get("/:id", (0, authorize_1.authorize)(policies_1.POLICIES.viewUsers), (0, asyncHandler_1.asyncHandler)(userController_1.getUserHandler));
router.patch("/:id", (0, authorize_1.authorize)(policies_1.POLICIES.manageUsers), (0, validate_1.validate)(userSchemas_1.updateUserSchema), (0, asyncHandler_1.asyncHandler)(userController_1.updateUserHandler));
router.delete("/:id", (0, authorize_1.authorize)(policies_1.POLICIES.manageUsers), (0, asyncHandler_1.asyncHandler)(userController_1.deleteUserHandler));
exports.default = router;
//# sourceMappingURL=userRoute.js.map