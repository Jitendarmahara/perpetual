import { createClient } from "@repo/redis_data";
import { resolveMap, INSTANCE_ID } from "./loopback";
import router from "./routes/user";
import express from "express";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
const app = express();
app.set("trust proxy", 1);

app.use(express.json());

// Enable CORS for frontend requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With");
  
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

const redis_client = await createClient();

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  limit: 20, // max 10 requests per IP
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis_client.sendCommand(args),
  }),
  handler: (_req, res) => {
    res.status(429).json({
      error: "Too many requests. Max 10 per minute per IP.",
    });
  },
});

type StreamResponse = {
  name: string;
  messages: { id: string; message: Record<string, string> }[];
}[];

async function EventsListener() {
  let lastId = "$";
  while (true) {
    const response = (await redis_client.xRead(
      [{ key: "events_stream", id: lastId }],
      { BLOCK: 0},
    )) as StreamResponse | null;

    if (!response) continue;

    for (const stream of response) {
      for (const msg of stream.messages) {
        lastId = msg.id;
        const data = JSON.parse(msg.message.data!);
        if (typeof data.loopbackid !== "string") {
          continue;
        }

        const resolve = resolveMap.get(data.loopbackid);
        if (resolve) {
          resolve(data);
          resolveMap.delete(data.loopbackid);
        }

        console.log("backend event:", msg.id, data);
      }
    }
  }
}

EventsListener();

app.use("/api/v1", limiter);
app.use("/api/v1", router);

app.listen(3000, () => {
  console.log("Backend server running on port 3000");
});
