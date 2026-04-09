import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import { POLICIES } from "../middleware/policies";
import { createReportSchema, updateReportSchema, listReportsSchema } from "../schemas/reportSchemas";
import {
  createReportHandler,
  listReportsHandler,
  getReportHandler,
  updateReportHandler,
  deleteReportHandler,
  statsReportHandler,
} from "../controllers/reportController";

const router = Router();

// All report routes require authentication
router.use(authenticate);

router.post(  "/",       authorize(POLICIES.createReport), validate(createReportSchema),         asyncHandler(createReportHandler));
router.get(   "/",       authorize(POLICIES.viewReports),  validate(listReportsSchema, "query"), asyncHandler(listReportsHandler));
router.get(   "/stats",  authorize(POLICIES.viewReports),                                        asyncHandler(statsReportHandler));
router.get(   "/:id",    authorize(POLICIES.viewReports),                                        asyncHandler(getReportHandler));
router.patch( "/:id",    authorize(POLICIES.createReport), validate(updateReportSchema),         asyncHandler(updateReportHandler));
router.delete("/:id",    authorize(POLICIES.deleteReport),                                       asyncHandler(deleteReportHandler));

export default router;
