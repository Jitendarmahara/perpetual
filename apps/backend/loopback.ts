import { randomUUID } from "node:crypto";
import { createClient } from "@repo/redis_data";

const redis_client = await createClient();
export const INSTANCE_ID = process.env.INSTANCE_ID || randomUUID();

export let resolveMap = new Map<string, (value: unknown) => void>();
export async function Loopback(message: Record<string, unknown>) {
  const loopbackId = message.loopbackid;
  if (typeof loopbackId !== "string") {
    throw new Error("loopbackid is required");
  }

  let rejectResponse!: (reason?: unknown) => void;
  let timeoutId!: ReturnType<typeof setTimeout>;
  const responsePromise = new Promise((resolve, reject) => {
    rejectResponse = reject;
    timeoutId = setTimeout(() => {
      if (resolveMap.has(loopbackId)) {
        reject(new Error("timed out"));
        resolveMap.delete(loopbackId);
      }
    }, 10000);

    resolveMap.set(loopbackId, (value: unknown) => {
      clearTimeout(timeoutId);
      resolve(value);
    });
  });

  try {
    await redis_client.xAdd("input_stream", "*", {
      data: JSON.stringify(message),
    });
  } catch (error) {
    clearTimeout(timeoutId);
    resolveMap.delete(loopbackId);
    rejectResponse(error);
  }

  return responsePromise;
}
