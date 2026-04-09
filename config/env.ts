import dotenv from "dotenv";
import path from "path";

/**
 * Loads the .env.local file exactly once.
 * Every other config module should import this file instead of calling
 * dotenv.config() itself, keeping the env-file path in a single place.
 */
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
