import "./env";

export const getMongoUri = (): string => {
  const mongodbUri = process.env.MONGODB_URI;

  if (!mongodbUri) {
    throw new Error("Missing MONGODB_URI in environment variables");
  }

  return mongodbUri;
};

export const getMongoDbName = (): string | undefined => process.env.MONGODB_DB_NAME;
