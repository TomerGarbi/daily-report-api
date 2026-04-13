import ActiveDirectory from "activedirectory2";
export declare const initializeActiveDirectory: () => ActiveDirectory;
export declare const getActiveDirectoryClient: () => ActiveDirectory;
export declare const authenticateUser: (username: string, password: string) => Promise<boolean>;
export declare const findUser: (username: string) => Promise<any>;
export declare const getUserGroups: (username: string) => Promise<any[]>;
//# sourceMappingURL=activeDirectoryService.d.ts.map