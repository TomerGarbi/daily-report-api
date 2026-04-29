import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import { POLICIES } from "../middleware/policies";
import { weatherForecastQuerySchema } from "../schemas/weatherSchemas";
import { getWeatherForecastHandler } from "../controllers/weatherController";

const router = Router();

router.use(authenticate);

// GET /weather/forecast?region=gush-dan
router.get(
  "/forecast",
  authorize(POLICIES.viewReports),
  validate(weatherForecastQuerySchema, "query"),
  asyncHandler(getWeatherForecastHandler),
);

export default router;
