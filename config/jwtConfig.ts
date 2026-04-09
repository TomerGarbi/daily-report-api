import "./env";
import type { StringValue } from "ms";

export type JwtConfig = {
  secret: string;
  expiresIn: StringValue;
  refreshSecret: string;
  refreshExpiresIn: StringValue;
};

export const getJwtConfig = (): JwtConfig => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN;

  if (!secret) {
    throw new Error("Missing JWT_SECRET in environment variables");
  }

  if (!expiresIn) {
    throw new Error("Missing JWT_EXPIRES_IN in environment variables");
  }

  if (!refreshSecret) {
    throw new Error("Missing JWT_REFRESH_SECRET in environment variables");
  }

  if (!refreshExpiresIn) {
    throw new Error("Missing JWT_REFRESH_EXPIRES_IN in environment variables");
  }

  return {
    secret,
    expiresIn: expiresIn as StringValue,
    refreshSecret,
    refreshExpiresIn: refreshExpiresIn as StringValue,
  };
};
