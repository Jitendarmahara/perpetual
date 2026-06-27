
import { Registry, Counter, Gauge, collectDefaultMetrics } from "prom-client";
import http from "http";

export const register = new Registry();
collectDefaultMetrics({ register });

export const eventssavedTotal = new Counter({
  name: "db_poller_events_saved_total",
  help: "Total events persisted to database",
  registers: [register],
});

export const eventsFailedTotal = new Counter({
  name: "db_poller_events_failed_total",
  help: "Total events that failed to persist",
  registers: [register],
});

export const pendingMessages = new Gauge({
  name: "db_poller_pending_messages",
  help: "Consumer group pending messages lag",
  registers: [register],
});

http.createServer(async (_req, res) => {
  res.setHeader("Content-Type", register.contentType);
  res.end(await register.metrics());
}).listen(9103);