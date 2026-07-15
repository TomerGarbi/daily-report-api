import fs from "fs";
import path from "path";
import { isProduction } from "./appConfig";
import { Role } from "../types/auth";

export interface DevUser {
  username: string;
  password: string;
  role: Role;
  groups: string[];
}

let cached: DevUser[] | null = null;

const VALID_ROLES: Role[] = ["admin", "manager", "user", "guest"];

/**
 * Resolve the dev-users JSON file path. Defaults to `dev-users.json` at the
 * api root; can be overridden via `DEV_USERS_FILE`.
 */
const resolveDevUsersPath = (): string => {
  const explicit = process.env.DEV_USERS_FILE;
  if (explicit && explicit.trim().length > 0) return path.resolve(explicit);
  return path.resolve(__dirname, "..", "dev-users.json");
};

const parseDevUsers = (raw: unknown): DevUser[] => {
  if (!raw || typeof raw !== "object") {
    throw new Error("dev-users file must contain a JSON object with a `users` array");
  }
  const users = (raw as { users?: unknown }).users;
  if (!Array.isArray(users)) {
    throw new Error("dev-users file: `users` must be an array");
  }
  return users.map((u, idx) => {
    if (!u || typeof u !== "object") {
      throw new Error(`dev-users file: entry ${idx} is not an object`);
    }
    const o = u as Record<string, unknown>;
    const username = o.username;
    const password = o.password;
    const role = o.role;
    const groups = o.groups;
    if (typeof username !== "string" || username.length === 0) {
      throw new Error(`dev-users file: entry ${idx} has invalid username`);
    }
    if (typeof password !== "string" || password.length === 0) {
      throw new Error(`dev-users file: entry ${idx} has invalid password`);
    }
    if (typeof role !== "string" || !VALID_ROLES.includes(role as Role)) {
      throw new Error(`dev-users file: entry ${idx} has invalid role`);
    }
    if (!Array.isArray(groups) || !groups.every((g) => typeof g === "string")) {
      throw new Error(`dev-users file: entry ${idx} has invalid groups`);
    }
    return {
      username,
      password,
      role: role as Role,
      groups: groups as string[],
    };
  });
};

/**
 * Load the dev-only user list. Only callable when NODE_ENV !== "production";
 * calling it in production throws immediately (fail-fast) so a
 * misconfiguration can never enable password-based fallback auth in prod.
 *
 * Returns `[]` (with a warning at the call site) if the file is missing —
 * dev auth simply won't accept anyone in that case.
 */
export const loadDevUsers = (): DevUser[] => {
  if (isProduction()) {
    throw new Error(
      "Refusing to load dev-users.json in production. " +
      "DEV_USERS_FILE / dev fallback auth is disabled when NODE_ENV=production.",
    );
  }
  if (cached) return cached;

  const filePath = resolveDevUsersPath();
  if (!fs.existsSync(filePath)) {
    cached = [];
    return cached;
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  cached = parseDevUsers(raw);
  return cached;
};

/** Test-only helper — clears the module cache so a fresh read picks up file changes. */
export const _resetDevUsersCache = (): void => {
  cached = null;
};
