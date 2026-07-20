import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate } from "../middleware/authenticate";
import { trackActivity } from "../middleware/trackActivity";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import { validateObjectId } from "../middleware/validateObjectId";
import { POLICIES } from "../middleware/policies";
import {
  createStationGroupSchema,
  updateStationGroupSchema,
  listStationGroupsSchema,
} from "../schemas/stationGroupSchemas";
import {
  listStationGroupsHandler,
  getStationGroupHandler,
  createStationGroupHandler,
  updateStationGroupHandler,
  deleteStationGroupHandler,
} from "../controllers/stationGroupController";

const router = Router();

router.use(authenticate);
router.use(trackActivity);

// Reads: any user who can view the station catalog.
router.get("/",    authorize(POLICIES.viewStations),  validate(listStationGroupsSchema, "query"), asyncHandler(listStationGroupsHandler));
router.get("/:id", validateObjectId(), authorize(POLICIES.viewStations),                                                       asyncHandler(getStationGroupHandler));

// Writes: same audience allowed to mutate stations.
router.post(  "/",    authorize(POLICIES.manageStations), validate(createStationGroupSchema), asyncHandler(createStationGroupHandler));
router.patch( "/:id", validateObjectId(), authorize(POLICIES.manageStations), validate(updateStationGroupSchema), asyncHandler(updateStationGroupHandler));
router.delete("/:id", validateObjectId(), authorize(POLICIES.manageStations),                                     asyncHandler(deleteStationGroupHandler));

export default router;
