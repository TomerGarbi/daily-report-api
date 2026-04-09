import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { authIpLimiter, authUsernameLimiter, refreshRateLimiter } from "../middleware/rateLimiter";
import { loginSchema, refreshSchema, logoutSchema } from "../schemas/authSchemas";
import {
  loginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
} from "../controllers/authController";

const router = Router();

router.post("/login",   authIpLimiter, authUsernameLimiter, validate(loginSchema), asyncHandler(loginHandler));
router.post("/refresh",  refreshRateLimiter,                                        asyncHandler(refreshHandler));
router.post("/logout",  authenticate,                                               asyncHandler(logoutHandler));
router.get("/me",       authenticate,                                               asyncHandler(meHandler));

export default router;
