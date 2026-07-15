import { authenticateUser, getUserGroups } from "./activeDirectoryService";
import { generateAccessToken, generateRefreshToken } from "./tokenService";
import { logger } from "./loggerService";
import { isDevelopment } from "../config/appConfig";
import { loadDevUsers } from "../config/devUsers";
import { AuthenticatedUser, Role } from "../types/auth";
import { User } from "../models/User";

// ─── Role resolver for AD (production) ───────────────────────────────────────

/**
 * Maps AD group memberships to an application Role.
 * Edit the group-name constants here to match your real AD group names.
 *
 * Priority: admin > manager > user > guest.
 */
const resolveRole = (groups: string[]): Role => {
  const lower = groups.map((g) => g.toLowerCase());

  if (lower.some((g) => g.includes("it-admins") || g.includes("administrators"))) {
    return "admin";
  }
  if (lower.some((g) => g.includes("managers") || g.includes("management"))) {
    return "manager";
  }
  if (lower.some((g) => g.includes("staff") || g.includes("employees") || g.includes("users"))) {
    return "user";
  }

  return "guest";
};

// ─── First-login user provisioning ──────────────────────────────────────────

/**
 * Ensures a User document exists in the database for the given username.
 * If this is the first time the user has logged in, the document is created
 * with the resolved role so the DB record always matches the issued token.
 *
 * Role is intentionally NOT overwritten on subsequent logins — it is managed
 * in the database (e.g. promoted to admin/manager by an administrator).
 *
 * Also records successful-login metadata (`lastLoginAt`, `lastLoginIp`,
 * `loginCount`) and clears any accumulated failed-login counter.
 */
const upsertUserOnLogin = async (
  username: string,
  role: Role,
  ip?: string,
): Promise<{ disabled: boolean }> => {
  try {
    const setOnInsert: Record<string, unknown> = { role, groups: [] };
    const set: Record<string, unknown> = {
      lastLoginAt: new Date(),
      failedLoginCount: 0,
    };
    if (ip) set["lastLoginIp"] = ip;

    const doc = await User.findOneAndUpdate(
      { username },
      {
        $setOnInsert: setOnInsert,
        $set: set,
        $inc: { loginCount: 1 },
      },
      { upsert: true, new: true, projection: { disabled: 1 } },
    ).lean();

    logger.debug("User upserted on login", "AuthService", { username, role });
    return { disabled: Boolean(doc?.disabled) };
  } catch (err) {
    // Non-fatal but important: the issued token may contain a role/groups
    // that aren't reflected in the database. Log at warn level so it's
    // visible in production dashboards.
    logger.warn("Failed to upsert user on login — token may diverge from DB", "AuthService", {
      username,
      error: err instanceof Error ? err.message : String(err),
    });
    return { disabled: false };
  }
};

/**
 * Record a failed login attempt so the admin UI can surface accounts under
 * attack. Never throws — a failing counter must never mask the real reason
 * the login was rejected.
 */
const recordFailedLogin = async (username: string): Promise<void> => {
  try {
    await User.updateOne(
      { username },
      { $inc: { failedLoginCount: 1 } },
    );
  } catch (err) {
    logger.debug("Failed-login counter update failed", "AuthService", {
      username,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

// ─── Login result ─────────────────────────────────────────────────────────────

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: Omit<AuthenticatedUser, "attributes">;
}

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Authenticates a user and returns a signed access + refresh token pair.
 *
 * - In **development** (`NODE_ENV=development`): validates against the
 *   hardcoded `DEV_USERS` list. No AD connection required.
 * - In **production**: authenticates via Active Directory, then fetches
 *   the user's group memberships and resolves their application role.
 *
 * Throws a plain `Error` with a safe message on failure (no internal details
 * are leaked — callers should return 401 without exposing the reason).
 *
 * The optional `ip` is stored on the user document as `lastLoginIp` so
 * admins can spot logins from unexpected addresses.
 */
export const login = async (
  username: string,
  password: string,
  ip?: string,
): Promise<LoginResult> => {

  // ── Development mode ────────────────────────────────────────────────────────
  if (isDevelopment()) {
    logger.debug("Login attempt (dev mode)", "AuthService", { username });

    const devUsers = loadDevUsers();
    if (devUsers.length === 0) {
      logger.warn(
        "Dev login attempted but no dev users are configured (missing dev-users.json)",
        "AuthService",
        { username },
      );
      throw new Error("Invalid credentials");
    }

    const devUser = devUsers.find(
      (u) => u.username === username && u.password === password
    );

    if (!devUser) {
      logger.warn("Dev login failed — invalid credentials", "AuthService", { username });
      await recordFailedLogin(username);
      throw new Error("Invalid credentials");
    }

    const user: AuthenticatedUser = {
      username: devUser.username,
      role: devUser.role,
      groups: devUser.groups,
    };

    const { disabled } = await upsertUserOnLogin(username, devUser.role, ip);
    if (disabled) {
      logger.warn("Dev login blocked — account disabled", "AuthService", { username });
      throw new Error("Account disabled");
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    logger.info("Dev login successful", "AuthService", {
      username,
      role: devUser.role,
    });

    return { accessToken, refreshToken, user };
  }

  // ── Production mode (Active Directory) ─────────────────────────────────────
  logger.debug("Login attempt (production / AD)", "AuthService", { username });

  let authenticated: boolean;
  try {
    authenticated = await authenticateUser(username, password);
  } catch {
    logger.error("AD authentication threw an error", "AuthService", { username });
    await recordFailedLogin(username);
    throw new Error("Invalid credentials");
  }

  if (!authenticated) {
    logger.warn("AD login failed — invalid credentials", "AuthService", { username });
    await recordFailedLogin(username);
    throw new Error("Invalid credentials");
  }

  let groups: string[];
  try {
    const raw: any[] = await getUserGroups(username);
    groups = raw.map((g) => (typeof g === "string" ? g : (g.cn ?? g.dn ?? "")));
  } catch {
    logger.warn("Could not fetch AD groups, defaulting to empty", "AuthService", { username });
    groups = [];
  }

  const role = resolveRole(groups);

  const user: AuthenticatedUser = { username, role, groups };

  // Production: new AD users are provisioned with their resolved role.
  // Existing users keep whatever role they have in the DB.
  const { disabled } = await upsertUserOnLogin(username, role, ip);
  if (disabled) {
    logger.warn("AD login blocked — account disabled", "AuthService", { username });
    throw new Error("Account disabled");
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  logger.info("AD login successful", "AuthService", { username, role });

  return { accessToken, refreshToken, user };
};
