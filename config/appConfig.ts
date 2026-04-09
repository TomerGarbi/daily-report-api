import "./env";

export const getPort = (): number => {
  const port = process.env.PORT;

  if (!port) {
    throw new Error("Missing PORT in environment variables");
  }

  return parseInt(port, 10);
};

export const getNodeEnv = (): string => {
  return process.env.NODE_ENV || "development";
};

export const isDevelopment = (): boolean => {
  return getNodeEnv() === "development";
};

export const isProduction = (): boolean => {
  return getNodeEnv() === "production";
};
