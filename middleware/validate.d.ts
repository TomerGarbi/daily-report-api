import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
type RequestPart = "body" | "params" | "query";
/**
 * Validates a part of the request against a Zod schema.
 * On success, replaces the request part with the parsed (typed) data.
 * On failure, responds with 400 and the list of validation errors.
 */
export declare const validate: (schema: ZodSchema, part?: RequestPart) => (req: Request, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=validate.d.ts.map