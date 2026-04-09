import ActiveDirectory from "activedirectory2";
import { getActiveDirectoryConfig } from "../config/activeDirectoryConfig";
import { logger } from "./loggerService";

let adClient: ActiveDirectory | null = null;

export const initializeActiveDirectory = (): ActiveDirectory => {
  try {
    logger.info("Initializing Active Directory client", "ActiveDirectoryService");

    const config = getActiveDirectoryConfig();

    adClient = new ActiveDirectory({
      url: config.url,
      baseDN: config.baseDN,
      username: config.username,
      password: config.password,
    });

    logger.info("Active Directory client initialized successfully", "ActiveDirectoryService", {
      url: config.url,
      baseDN: config.baseDN,
    });

    return adClient;
  } catch (error) {
    logger.error("Failed to initialize Active Directory client", "ActiveDirectoryService", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const getActiveDirectoryClient = (): ActiveDirectory => {
  if (!adClient) {
    return initializeActiveDirectory();
  }
  return adClient;
};

export const authenticateUser = (
  username: string,
  password: string
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const client = getActiveDirectoryClient();

    logger.debug("Attempting to authenticate user", "ActiveDirectoryService", {
      username,
    });

    client.authenticate(username, password, (err, auth) => {
      if (err) {
        logger.error("Authentication error", "ActiveDirectoryService", {
          username,
          error: typeof err === 'string' ? err : (err as Error).message,
        });
        reject(err);
        return;
      }

      if (auth) {
        logger.info("User authenticated successfully", "ActiveDirectoryService", {
          username,
        });
      } else {
        logger.warn("User authentication failed", "ActiveDirectoryService", {
          username,
        });
      }

      resolve(auth);
    });
  });
};

export const findUser = (username: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const client = getActiveDirectoryClient();

    logger.debug("Finding user in Active Directory", "ActiveDirectoryService", {
      username,
    });

    client.findUser(username, (err, user) => {
      if (err) {
        logger.error("Error finding user in Active Directory", "ActiveDirectoryService", {
          username,
          error: (err as Error).message || String(err),
        });
        reject(err);
        return;
      }

      if (user) {
        logger.info("User found in Active Directory", "ActiveDirectoryService", {
          username,
          dn: (user as any).dn,
        });
      } else {
        logger.warn("User not found in Active Directory", "ActiveDirectoryService", {
          username,
        });
      }

      resolve(user);
    });
  });
};

export const getUserGroups = (username: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const client = getActiveDirectoryClient();

    logger.debug("Fetching user groups from Active Directory", "ActiveDirectoryService", {
      username,
    });

    client.getGroupMembershipForUser(username, (err, groups) => {
      if (err) {
        logger.error("Error fetching user groups", "ActiveDirectoryService", {
          username,
          error: (err as Error).message || String(err),
        });
        reject(err);
        return;
      }

      logger.info("Successfully fetched user groups", "ActiveDirectoryService", {
        username,
        groupCount: groups ? groups.length : 0,
      });

      resolve(groups || []);
    });
  });
};
