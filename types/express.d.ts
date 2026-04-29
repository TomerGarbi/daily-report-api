import { AuthenticatedUser } from "./auth";

declare module "express-serve-static-core" {
  interface Request {
    /**
     * The authenticated user, populated by your authentication middleware
     * (e.g. JWT verification or Active Directory session).
     * Undefined when the request has not been authenticated yet.
     */
    user?: AuthenticatedUser;

    /**
     * Per-request correlation id. Populated by the requestId middleware,
     * reusing an inbound `X-Request-Id` header when valid or generating a UUID.
     */
    id?: string;
  }
}
