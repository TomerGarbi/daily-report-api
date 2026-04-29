import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { BadRequestError } from "../errors/AppError";

/**
 * Route-param middleware that verifies the named param is a valid Mongo ObjectId.
 * Lets us return a clean 400 instead of letting Mongoose surface a CastError as 500.
 *
 * @example
 *   router.get("/:id", validateObjectId(), asyncHandler(getReportHandler));
 *   router.delete("/:id/units/:unitId", validateObjectId("unitId"), ...);
 */
export const validateObjectId = (paramName: string = "id") => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    if (typeof value !== "string" || !Types.ObjectId.isValid(value)) {
      throw new BadRequestError(
        `Invalid '${paramName}' parameter: must be a valid ObjectId`,
        "ValidateObjectId"
      );
    }
    next();
  };
};
