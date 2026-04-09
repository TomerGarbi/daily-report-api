import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodIssue } from "zod";

type RequestPart = "body" | "params" | "query";

/**
 * Validates a part of the request against a Zod schema.
 * On success, replaces the request part with the parsed (typed) data.
 * On failure, responds with 400 and the list of validation errors.
 */
export const validate = (schema: ZodSchema, part: RequestPart = "body") => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      const errors = result.error.issues.map((e: ZodIssue) => ({
        field: e.path.join("."),
        message: e.message,
      }));

      res.status(400).json({
        status: 400,
        message: "Validation failed",
        errors,
      });
      return;
    }

    // Replace with parsed data so downstream handlers get typed, coerced values.
    // Express 5: req.query is a read-only getter — mutate in-place instead of reassigning.
    if (part === "query") {
      const q = req.query as Record<string, unknown>;
      for (const key of Object.keys(q)) delete q[key];
      Object.assign(q, result.data);
    } else {
      req[part] = result.data;
    }
    next();
  };
};
