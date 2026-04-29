import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

const REQUEST_ID_HEADER = "x-request-id";
// RFC 4122 UUID or simple alphanumerics with dashes — keep short and printable.
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Attaches a request id to every request:
 * - Reuses an inbound `X-Request-Id` header when present and well-formed
 * - Generates a UUID otherwise
 * - Echoes the id back on the response for client-side correlation
 */
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const incoming = req.header(REQUEST_ID_HEADER);
  const id =
    typeof incoming === "string" && SAFE_REQUEST_ID.test(incoming)
      ? incoming
      : randomUUID();

  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
};
