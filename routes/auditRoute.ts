import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate } from "../middleware/authenticate";
import { trackActivity } from "../middleware/trackActivity";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import { POLICIES } from "../middleware/policies";
import { listAuditSchema } from "../schemas/auditSchemas";
import {
  listAuditHandler,
  statsAuditHandler,
  userTimelineHandler,
} from "../controllers/auditController";

const router = Router();

// All audit routes require authentication + admin authorization.
router.use(authenticate);
router.use(trackActivity);

router.get("/",       authorize(POLICIES.viewAudit), validate(listAuditSchema, "query"), asyncHandler(listAuditHandler));
router.get("/stats",  authorize(POLICIES.viewAudit),                                     asyncHandler(statsAuditHandler));
router.get("/user/:username/timeline", authorize(POLICIES.viewAudit),                    asyncHandler(userTimelineHandler));

export default router;
