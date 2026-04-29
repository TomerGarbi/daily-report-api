import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import { validateObjectId } from "../middleware/validateObjectId";
import { POLICIES } from "../middleware/policies";
import {
  createStationSchema,
  updateStationSchema,
  listStationsSchema,
  unitSchema,
  updateUnitSchema,
} from "../schemas/stationSchemas";
import {
  listStationsHandler,
  getStationHandler,
  createStationHandler,
  updateStationHandler,
  deleteStationHandler,
  addUnitHandler,
  updateUnitHandler,
  removeUnitHandler,
} from "../controllers/stationController";

const router = Router();

// Every station route requires authentication.
router.use(authenticate);

// ── Read: any authenticated user that can view reports ──────────────────────
router.get("/",    authorize(POLICIES.viewStations), validate(listStationsSchema, "query"), asyncHandler(listStationsHandler));
router.get("/:id", validateObjectId(), authorize(POLICIES.viewStations),                                        asyncHandler(getStationHandler));

// ── Write: admin / IT-Admins (catalog management) ───────────────────────────
router.post(  "/",    authorize(POLICIES.manageStations), validate(createStationSchema), asyncHandler(createStationHandler));
router.patch( "/:id", validateObjectId(), authorize(POLICIES.manageStations), validate(updateStationSchema), asyncHandler(updateStationHandler));
router.delete("/:id", validateObjectId(), authorize(POLICIES.manageStations),                                asyncHandler(deleteStationHandler));

// ── Unit sub-resource ───────────────────────────────────────────────────────
router.post(  "/:id/units",          validateObjectId(), authorize(POLICIES.manageStations), validate(unitSchema),       asyncHandler(addUnitHandler));
router.patch( "/:id/units/:unitId",  validateObjectId(), validateObjectId("unitId"), authorize(POLICIES.manageStations), validate(updateUnitSchema), asyncHandler(updateUnitHandler));
router.delete("/:id/units/:unitId",  validateObjectId(), validateObjectId("unitId"), authorize(POLICIES.manageStations),                             asyncHandler(removeUnitHandler));

export default router;
