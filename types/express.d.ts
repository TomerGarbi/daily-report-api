import { AuthenticatedUser } from "./auth";

declare module "express-serve-static-core" {
  interface Request {
    /**
     * The authenticated user, populated by your authentication middleware
     * (e.g. JWT verification or Active Directory session).
     * Undefined when the request has not been authenticated yet.
     */
    user?: AuthenticatedUser;
  }
}
