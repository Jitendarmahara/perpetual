import { createClient as redisCreateClient } from "redis";

const DEFAULT_REDIS_URL = "redis://127.0.0.1:6379";

export function getRedisUrl() {
  return process.env.REDIS_URL || DEFAULT_REDIS_URL;
}

function formatRedisError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export type {
  ToEngineOnRamp,
  FromEngineOnRamp,
  PriceData,
  FillData,
  OrderUpdate,
} from "./types/types";
export { Type } from "./types/types";
export async function createClient() {
  const redisUrl = getRedisUrl();
  const client = redisCreateClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: false,
    },
  });
  let isConnecting = true;
  client.on("error", (error) => {
    if (isConnecting) {
      return;
    }

    console.error(`[redis] ${redisUrl}: ${formatRedisError(error)}`);
  });

  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Failed to connect to Redis at ${redisUrl}: ${formatRedisError(error)}`,
    );
  } finally {
    isConnecting = false;
  }

  return client;
}
export const createclint = createClient;
