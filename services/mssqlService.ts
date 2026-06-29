import sql, { type ConnectionPool, type IResult } from "mssql";
import { getMssqlConfig, isMssqlEnabled } from "../config/mssqlConfig";
import { logger } from "./loggerService";

let pool: ConnectionPool | null = null;
let connecting: Promise<ConnectionPool> | null = null;

/**
 * Returns a shared, connected MS SQL connection pool. The pool is created
 * lazily on first use and reused for every subsequent call. Concurrent
 * callers during the initial connect await the same promise so we never
 * open more than one pool.
 */
export const getMssqlPool = async (): Promise<ConnectionPool> => {
  if (pool && pool.connected) return pool;
  if (connecting) return connecting;

  if (!isMssqlEnabled()) {
    throw new Error("MSSQL is not configured (MSSQL_SERVER is unset)");
  }

  const config = getMssqlConfig();
  logger.info("Connecting to MSSQL", "MssqlService", {
    server: config.server,
    database: config.database,
  });

  connecting = new sql.ConnectionPool(config)
    .connect()
    .then((connected) => {
      pool = connected;
      pool.on("error", (err) => {
        logger.error("MSSQL pool error", "MssqlService", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
      logger.info("Successfully connected to MSSQL", "MssqlService", {
        server: config.server,
        database: config.database,
      });
      return connected;
    })
    .catch((err) => {
      logger.error("Failed to connect to MSSQL", "MssqlService", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    })
    .finally(() => {
      connecting = null;
    });

  return connecting;
};

/**
 * Runs a parameterized SQL query against the shared pool. Always use named
 * parameters instead of string interpolation to avoid SQL injection.
 *
 * @example
 *   const rows = await mssqlQuery<{ Id: number; Name: string }>(
 *     "SELECT Id, Name FROM dbo.Users WHERE Id = @id",
 *     { id: 42 },
 *   );
 */
export const mssqlQuery = async <T = Record<string, unknown>>(
  query: string,
  params: Record<string, unknown> = {},
): Promise<IResult<T>> => {
  const connectedPool = await getMssqlPool();
  const request = connectedPool.request();
  for (const [name, value] of Object.entries(params)) {
    request.input(name, value);
  }
  return request.query<T>(query);
};

export const disconnectMssql = async (): Promise<void> => {
  if (!pool) return;
  try {
    logger.info("Disconnecting from MSSQL", "MssqlService");
    await pool.close();
    logger.info("Successfully disconnected from MSSQL", "MssqlService");
  } catch (err) {
    logger.error("Failed to disconnect from MSSQL", "MssqlService", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    pool = null;
  }
};

export { sql };
