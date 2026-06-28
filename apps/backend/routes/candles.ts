import { Router, type Request, type Response } from "express";
import { client } from "@repo/db/client";

const router = Router();

// Always query the raw trades hypertable so we include the current partial
// candle and don't depend on the materialized view refresh cycle.
const INTERVAL_BUCKET: Record<string, string> = {
  "1m":  "1 minute",
  "5m":  "5 minutes",
  "15m": "15 minutes",
  "1H":  "1 hour",
  "2H":  "2 hours",
  "4H":  "4 hours",
  "1D":  "1 day",
};

const INTERVAL_SEC: Record<string, number> = {
  "1m":  60,
  "5m":  300,
  "15m": 900,
  "1H":  3_600,
  "2H":  7_200,
  "4H":  14_400,
  "1D":  86_400,
};

type CandleRow = {
  bucket: Date;
  open:   string;
  high:   string;
  low:    string;
  close:  string;
  volume: string;
};

router.get("/candles", async (req: Request, res: Response) => {
  const market   = req.query.market as string;
  const interval = (req.query.interval as string) || "1m";

  if (!market) {
    return res.status(400).json({ success: false, error: "Missing required parameter: market" });
  }

  const bucket      = INTERVAL_BUCKET[interval];
  const intervalSec = INTERVAL_SEC[interval];
  if (!bucket || !intervalSec) {
    return res.status(400).json({ success: false, error: "Invalid interval" });
  }

  try {
    const marketRecord = await client.market.findUnique({ where: { market_slug: market } });
    if (!marketRecord) return res.json({ success: true, candles: [] });

    // Look back 500 candles worth of history
    const since = new Date(Date.now() - intervalSec * 500 * 1000);

    const rows = await client.$queryRawUnsafe<CandleRow[]>(
      `SELECT time_bucket(INTERVAL '${bucket}', executed_at) AS bucket,
              CAST(first(price, executed_at) AS TEXT) AS open,
              CAST(max(price)               AS TEXT) AS high,
              CAST(min(price)               AS TEXT) AS low,
              CAST(last(price, executed_at) AS TEXT) AS close,
              CAST(sum(qty)                 AS TEXT) AS volume
       FROM trades
       WHERE market_id = $1
         AND executed_at >= $2
       GROUP BY bucket
       ORDER BY bucket ASC
       LIMIT 500`,
      marketRecord.id,
      since,
    );

    const candles = rows.map((r) => ({
      time:   Math.floor(new Date(r.bucket).getTime() / 1000),
      open:   Number(r.open),
      high:   Number(r.high),
      low:    Number(r.low),
      close:  Number(r.close),
      volume: Number(r.volume),
    }));

    return res.json({ success: true, candles });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
