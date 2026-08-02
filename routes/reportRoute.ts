import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate } from "../middleware/authenticate";
import { trackActivity } from "../middleware/trackActivity";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import { validateObjectId } from "../middleware/validateObjectId";
import { POLICIES } from "../middleware/policies";
import { createReportSchema, updateReportSchema, listReportsSchema, createReportFromDbSchema, dbSectionQuerySchema } from "../schemas/reportSchemas";
import {
  createReportHandler,
  listReportsHandler,
  getReportHandler,
  updateReportHandler,
  deleteReportHandler,
  statsReportHandler,
  getYesterdayArchiveHandler,
  getLastYearSameDayHandler,
  createReportFromDbHandler,
  getDbSectionHandler,
} from "../controllers/reportController";

const router = Router();

// All report routes require authentication
router.use(authenticate);
router.use(trackActivity);

router.post(  "/",           authorize(POLICIES.createReport), validate(createReportSchema),           asyncHandler(createReportHandler));
router.post(  "/from-db",    authorize(POLICIES.createReport), validate(createReportFromDbSchema),     asyncHandler(createReportFromDbHandler));
router.get(   "/db-section", authorize(POLICIES.createReport), validate(dbSectionQuerySchema, "query"), asyncHandler(getDbSectionHandler));
router.get(   "/",       authorize(POLICIES.viewReports),  validate(listReportsSchema, "query"), asyncHandler(listReportsHandler));
router.get(   "/stats",  authorize(POLICIES.viewReports),                                        asyncHandler(statsReportHandler));
router.get(   "/archive/yesterday", authorize(POLICIES.viewReports),                             asyncHandler(getYesterdayArchiveHandler));
router.get(   "/archive/last-year", authorize(POLICIES.viewReports),                             asyncHandler(getLastYearSameDayHandler));
router.get(   "/:id",    validateObjectId(), authorize(POLICIES.viewReports),                                        asyncHandler(getReportHandler));
router.patch( "/:id",    validateObjectId(), authorize(POLICIES.createReport), validate(updateReportSchema),         asyncHandler(updateReportHandler)); // fine-grained owner/manager check inside handler
router.delete("/:id",    validateObjectId(), authorize(POLICIES.deleteReport),                                       asyncHandler(deleteReportHandler));

export default router;
