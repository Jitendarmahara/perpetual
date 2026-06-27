
import { Registry, Counter, Gauge, collectDefaultMetrics } from "prom-client";
import http from "http";

export const register = new Registry();
collectDefaultMetrics({ register });

export const ordersProcessedTotal = new Counter({
  name: "engine_orders_processed_total",
  help: "Total orders processed",
  labelNames: ["market", "side"],
  registers: [register],
});

export const ordersFilledTotal = new Counter({
  name: "engine_orders_filled_total",
  help: "Total orders filled",
  labelNames: ["market"],
  registers: [register],
});

export const liquidationsTotal = new Counter({
  name: "engine_liquidations_total",
  help: "Total liquidations triggered",
  labelNames: ["market"],
  registers: [register],
});

export const inputStreamLag = new Gauge({
  name: "engine_input_stream_lag",
  help: "How many ms behind the engine is processing messages",
  registers: [register],
});

http.createServer(async (_req, res) => {
  res.setHeader("Content-Type", register.contentType);
  res.end(await register.metrics());
}).listen(9101);
