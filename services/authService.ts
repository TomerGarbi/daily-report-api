import { authenticateUser, getUserGroups } from "./activeDirectoryService";
import { generateAccessToken, generateRefreshToken } from "./tokenService";
import { logger } from "./loggerService";
import { isDevelopment } from "../config/appConfig";
import { AuthenticatedUser, Role } from "../types/auth";
import { User } from "../models/User";

// ─── Dev user store ───────────────────────────────────────────────────────────

/**
 * Hardcoded users used in development mode only.
 * Never present in a production build.
 *
 * Password is stored in plain text here intentionally — this list is only
 * ever active when NODE_ENV=development.
 */
const DEV_USERS: Array<{
  username: string;
  password: string;
  role: Role;
  groups: string[];
}> = [
  {
    username: "admin",
    password: "admin123",
    role: "admin",
    groups: ["IT-Admins", "Managers"],
  },
  {
    username: "manager",
    password: "manager123",
    role: "manager",
    groups: ["Managers", "Finance"],
  },
  {
    username: "user",
    password: "user123",
    role: "user",
    groups: ["Staff"],
  },
  {
    username: "guest",
    password: "guest123",
    role: "guest",
    groups: [],
  },
  {
    username: "sarah.admin",
    password: "sarah123",
    role: "admin",
    groups: ["IT-Admins"],
  },
  {
    username: "david.manager",
    password: "david123",
    role: "manager",
    groups: ["Managers"],
  },
  {
    username: "rachel.finance",
    password: "rachel123",
    role: "manager",
    groups: ["Finance", "Managers"],
  },
  {
    username: "alex.dev",
    password: "alex123",
    role: "user",
    groups: ["Staff"],
  },
  {
    username: "maya.dev",
    password: "maya123",
    role: "user",
    groups: ["Staff"],
  },
  {
    username: "tom.ops",
    password: "tom123",
    role: "user",
    groups: ["Staff", "IT-Admins"],
  },
  {
    username: "lisa.guest",
    password: "lisa123",
    role: "guest",
    groups: [],
  },
];

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
 */
const upsertUserOnLogin = async (username: string, role: Role): Promise<void> => {
  try {
    await User.findOneAndUpdate(
      { username },
      { $setOnInsert: { role, groups: [] } }, // only applied on first insert
      { upsert: true }
    );
    logger.debug("User upserted on login", "AuthService", { username, role });
  } catch (err) {
    // Non-fatal but important: the issued token may contain a role/groups
    // that aren't reflected in the database. Log at warn level so it's
    // visible in production dashboards.
    logger.warn("Failed to upsert user on login — token may diverge from DB", "AuthService", {
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
 */
export const login = async (
  username: string,
  password: string
): Promise<LoginResult> => {

  // ── Development mode ────────────────────────────────────────────────────────
  if (isDevelopment()) {
    logger.debug("Login attempt (dev mode)", "AuthService", { username });

    const devUser = DEV_USERS.find(
      (u) => u.username === username && u.password === password
    );

    if (!devUser) {
      logger.warn("Dev login failed — invalid credentials", "AuthService", { username });
      throw new Error("Invalid credentials");
    }

    const user: AuthenticatedUser = {
      username: devUser.username,
      role: devUser.role,
      groups: devUser.groups,
    };

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    logger.info("Dev login successful", "AuthService", {
      username,
      role: devUser.role,
    });

    await upsertUserOnLogin(username, devUser.role);

    return { accessToken, refreshToken, user };
  }

  // ── Production mode (Active Directory) ─────────────────────────────────────
  logger.debug("Login attempt (production / AD)", "AuthService", { username });

  let authenticated: boolean;
  try {
    authenticated = await authenticateUser(username, password);
  } catch {
    logger.error("AD authentication threw an error", "AuthService", { username });
    throw new Error("Invalid credentials");
  }

  if (!authenticated) {
    logger.warn("AD login failed — invalid credentials", "AuthService", { username });
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

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  logger.info("AD login successful", "AuthService", { username, role });

  // Production: new AD users are provisioned with their resolved role.
  // Existing users keep whatever role they have in the DB.
  await upsertUserOnLogin(username, role);

  return { accessToken, refreshToken, user };
};
