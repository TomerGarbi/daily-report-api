import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import { validateObjectId } from "../middleware/validateObjectId";
import { POLICIES } from "../middleware/policies";
import { listUsersSchema, updateUserSchema } from "../schemas/userSchemas";
import {
  statsUserHandler,
  listUsersHandler,
  getUserHandler,
  updateUserHandler,
  deleteUserHandler,
} from "../controllers/userController";

const router = Router();

// All user-management routes require authentication
router.use(authenticate);

// GET  /users        — managers, admins, HR, IT-Admins
// GET  /users/:id    — same
// PATCH /users/:id   — admins, IT-Admins only
// DELETE /users/:id  — admins, IT-Admins only
router.get(   "/stats", authorize(POLICIES.viewUsers),                                       asyncHandler(statsUserHandler));
router.get(   "/",     authorize(POLICIES.viewUsers),   validate(listUsersSchema, "query"), asyncHandler(listUsersHandler));
router.get(   "/:id",  validateObjectId(), authorize(POLICIES.viewUsers),                                       asyncHandler(getUserHandler));
router.patch( "/:id",  validateObjectId(), authorize(POLICIES.manageUsers), validate(updateUserSchema),         asyncHandler(updateUserHandler));
router.delete("/:id",  validateObjectId(), authorize(POLICIES.manageUsers),                                     asyncHandler(deleteUserHandler));

export default router;
