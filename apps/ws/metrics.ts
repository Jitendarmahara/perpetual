
import { Registry, Counter, Gauge, collectDefaultMetrics } from "prom-client";
import http from "http";

export const register = new Registry();
collectDefaultMetrics({ register });

export const wsActiveConnections = new Gauge({
  name: "ws_active_connections",
  help: "Current active WebSocket connections",
  registers: [register],
});

export const wsMessagesSentTotal = new Counter({
  name: "ws_messages_sent_total",
  help: "Total messages broadcast to clients",
  registers: [register],
});

export const wsConnectionErrorsTotal = new Counter({
  name: "ws_connection_errors_total",
  help: "Total WebSocket connection errors",
  registers: [register],
});
http.createServer(async (_req, res) => {
  res.setHeader("Content-Type", register.contentType);
  res.end(await register.metrics());
}).listen(9102);    