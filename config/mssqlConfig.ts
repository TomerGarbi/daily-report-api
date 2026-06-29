import "./env";
import type { config as MssqlConfig } from "mssql";

const parseIntEnv = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const parseBoolEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
};

export const isMssqlEnabled = (): boolean => Boolean(process.env.MSSQL_SERVER);

export const getMssqlConfig = (): MssqlConfig => {
  const server = process.env.MSSQL_SERVER;
  if (!server) {
    throw new Error("Missing MSSQL_SERVER in environment variables");
  }

  const database = process.env.MSSQL_DATABASE;
  if (!database) {
    throw new Error("Missing MSSQL_DATABASE in environment variables");
  }

  const user = process.env.MSSQL_USER;
  const password = process.env.MSSQL_PASSWORD;
  if (!user || !password) {
    throw new Error("Missing MSSQL_USER or MSSQL_PASSWORD in environment variables");
  }

  return {
    server,
    port: parseIntEnv(process.env.MSSQL_PORT, 1433),
    database,
    user,
    password,
    domain: process.env.MSSQL_DOMAIN || undefined,
    connectionTimeout: parseIntEnv(process.env.MSSQL_CONNECTION_TIMEOUT_MS, 15000),
    requestTimeout: parseIntEnv(process.env.MSSQL_REQUEST_TIMEOUT_MS, 15000),
    pool: {
      max: parseIntEnv(process.env.MSSQL_POOL_MAX, 10),
      min: parseIntEnv(process.env.MSSQL_POOL_MIN, 0),
      idleTimeoutMillis: parseIntEnv(process.env.MSSQL_POOL_IDLE_TIMEOUT_MS, 30000),
    },
    options: {
      encrypt: parseBoolEnv(process.env.MSSQL_ENCRYPT, false),
      trustServerCertificate: parseBoolEnv(process.env.MSSQL_TRUST_SERVER_CERTIFICATE, false),
    },
  };
};
