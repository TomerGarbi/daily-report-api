import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import { validateObjectId } from "../middleware/validateObjectId";
import { POLICIES } from "../middleware/policies";
import {
  createFuelSiteSchema,
  updateFuelSiteSchema,
  listFuelSitesSchema,
  tankSchema,
  updateTankSchema,
} from "../schemas/fuelSiteSchemas";
import {
  listFuelSitesHandler,
  getFuelSiteHandler,
  createFuelSiteHandler,
  updateFuelSiteHandler,
  deleteFuelSiteHandler,
  addTankHandler,
  updateTankHandler,
  removeTankHandler,
} from "../controllers/fuelSiteController";

const router = Router();

router.use(authenticate);

// ── Read ────────────────────────────────────────────────────────────────────
router.get("/",    authorize(POLICIES.viewFuelSites), validate(listFuelSitesSchema, "query"), asyncHandler(listFuelSitesHandler));
router.get("/:id", validateObjectId(), authorize(POLICIES.viewFuelSites),                     asyncHandler(getFuelSiteHandler));

// ── Write ───────────────────────────────────────────────────────────────────
router.post(  "/",    authorize(POLICIES.manageFuelSites), validate(createFuelSiteSchema), asyncHandler(createFuelSiteHandler));
router.patch( "/:id", validateObjectId(), authorize(POLICIES.manageFuelSites), validate(updateFuelSiteSchema), asyncHandler(updateFuelSiteHandler));
router.delete("/:id", validateObjectId(), authorize(POLICIES.manageFuelSites),                                 asyncHandler(deleteFuelSiteHandler));

// ── Tank sub-resource ───────────────────────────────────────────────────────
router.post(  "/:id/tanks",          validateObjectId(), authorize(POLICIES.manageFuelSites), validate(tankSchema),       asyncHandler(addTankHandler));
router.patch( "/:id/tanks/:tankId",  validateObjectId(), validateObjectId("tankId"), authorize(POLICIES.manageFuelSites), validate(updateTankSchema), asyncHandler(updateTankHandler));
router.delete("/:id/tanks/:tankId",  validateObjectId(), validateObjectId("tankId"), authorize(POLICIES.manageFuelSites),                             asyncHandler(removeTankHandler));

export default router;
