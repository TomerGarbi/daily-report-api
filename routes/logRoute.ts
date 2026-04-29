import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import { validateObjectId } from "../middleware/validateObjectId";
import { POLICIES } from "../middleware/policies";
import { listLogsSchema } from "../schemas/logSchemas";
import {
  listLogsHandler,
  statsLogsHandler,
  getLogHandler,
} from "../controllers/logController";

const router = Router();

// All log routes require authentication
router.use(authenticate);

router.get("/",      authorize(POLICIES.viewLogs), validate(listLogsSchema, "query"), asyncHandler(listLogsHandler));
router.get("/stats", authorize(POLICIES.viewLogs),                                    asyncHandler(statsLogsHandler));
router.get("/:id",   validateObjectId(), authorize(POLICIES.viewLogs),                                    asyncHandler(getLogHandler));

export default router;
