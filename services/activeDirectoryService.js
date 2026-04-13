"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserGroups = exports.findUser = exports.authenticateUser = exports.getActiveDirectoryClient = exports.initializeActiveDirectory = void 0;
const activedirectory2_1 = __importDefault(require("activedirectory2"));
const activeDirectoryConfig_1 = require("../config/activeDirectoryConfig");
const loggerService_1 = require("./loggerService");
let adClient = null;
const initializeActiveDirectory = () => {
    try {
        loggerService_1.logger.info("Initializing Active Directory client", "ActiveDirectoryService");
        const config = (0, activeDirectoryConfig_1.getActiveDirectoryConfig)();
        adClient = new activedirectory2_1.default({
            url: config.url,
            baseDN: config.baseDN,
            username: config.username,
            password: config.password,
        });
        loggerService_1.logger.info("Active Directory client initialized successfully", "ActiveDirectoryService", {
            url: config.url,
            baseDN: config.baseDN,
        });
        return adClient;
    }
    catch (error) {
        loggerService_1.logger.error("Failed to initialize Active Directory client", "ActiveDirectoryService", {
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
};
exports.initializeActiveDirectory = initializeActiveDirectory;
const getActiveDirectoryClient = () => {
    if (!adClient) {
        return (0, exports.initializeActiveDirectory)();
    }
    return adClient;
};
exports.getActiveDirectoryClient = getActiveDirectoryClient;
const authenticateUser = (username, password) => {
    return new Promise((resolve, reject) => {
        const client = (0, exports.getActiveDirectoryClient)();
        loggerService_1.logger.debug("Attempting to authenticate user", "ActiveDirectoryService", {
            username,
        });
        client.authenticate(username, password, (err, auth) => {
            if (err) {
                loggerService_1.logger.error("Authentication error", "ActiveDirectoryService", {
                    username,
                    error: typeof err === 'string' ? err : err.message,
                });
                reject(err);
                return;
            }
            if (auth) {
                loggerService_1.logger.info("User authenticated successfully", "ActiveDirectoryService", {
                    username,
                });
            }
            else {
                loggerService_1.logger.warn("User authentication failed", "ActiveDirectoryService", {
                    username,
                });
            }
            resolve(auth);
        });
    });
};
exports.authenticateUser = authenticateUser;
const findUser = (username) => {
    return new Promise((resolve, reject) => {
        const client = (0, exports.getActiveDirectoryClient)();
        loggerService_1.logger.debug("Finding user in Active Directory", "ActiveDirectoryService", {
            username,
        });
        client.findUser(username, (err, user) => {
            if (err) {
                loggerService_1.logger.error("Error finding user in Active Directory", "ActiveDirectoryService", {
                    username,
                    error: err.message || String(err),
                });
                reject(err);
                return;
            }
            if (user) {
                loggerService_1.logger.info("User found in Active Directory", "ActiveDirectoryService", {
                    username,
                    dn: user.dn,
                });
            }
            else {
                loggerService_1.logger.warn("User not found in Active Directory", "ActiveDirectoryService", {
                    username,
                });
            }
            resolve(user);
        });
    });
};
exports.findUser = findUser;
const getUserGroups = (username) => {
    return new Promise((resolve, reject) => {
        const client = (0, exports.getActiveDirectoryClient)();
        loggerService_1.logger.debug("Fetching user groups from Active Directory", "ActiveDirectoryService", {
            username,
        });
        client.getGroupMembershipForUser(username, (err, groups) => {
            if (err) {
                loggerService_1.logger.error("Error fetching user groups", "ActiveDirectoryService", {
                    username,
                    error: err.message || String(err),
                });
                reject(err);
                return;
            }
            loggerService_1.logger.info("Successfully fetched user groups", "ActiveDirectoryService", {
                username,
                groupCount: groups ? groups.length : 0,
            });
            resolve(groups || []);
        });
    });
};
exports.getUserGroups = getUserGroups;
//# sourceMappingURL=activeDirectoryService.js.map