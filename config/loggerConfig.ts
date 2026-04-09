import "./env";

export const getLogFilePath = (): string => {
  const logFilePath = process.env.LOG_FILE_PATH;

  if (!logFilePath) {
    throw new Error("Missing LOG_FILE_PATH in environment variables");
  }

  return logFilePath;
};

export const getLogLevel = (): string => {
  return process.env.LOG_LEVEL || "info";
};

export const isProduction = (): boolean => {
  return process.env.NODE_ENV === "production";
};
