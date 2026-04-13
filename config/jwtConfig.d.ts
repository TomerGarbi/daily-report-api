import "./env";
import type { StringValue } from "ms";
export type JwtConfig = {
    secret: string;
    expiresIn: StringValue;
    refreshSecret: string;
    refreshExpiresIn: StringValue;
};
export declare const getJwtConfig: () => JwtConfig;
//# sourceMappingURL=jwtConfig.d.ts.map