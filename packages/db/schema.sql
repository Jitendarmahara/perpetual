-- Run this after the normal Prisma database setup, against a PostgreSQL
-- server that already has TimescaleDB installed.

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "price" DECIMAL(36,18) NOT NULL,
    "qty" DECIMAL(36,18) NOT NULL,
    "executed_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id", "executed_at")
);

ALTER TABLE "trades" ADD CONSTRAINT "trades_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "trades_market_id_executed_at_idx" ON "trades"("market_id", "executed_at" DESC);

SELECT create_hypertable('trades', 'executed_at', if_not_exists => TRUE);

CREATE MATERIALIZED VIEW "candles_1m"
WITH (timescaledb.continuous) AS
SELECT
    "market_id",
    time_bucket(INTERVAL '1 minute', "executed_at") AS "bucket",
    first("price", "executed_at") AS "open",
    max("price") AS "high",
    min("price") AS "low",
    last("price", "executed_at") AS "close",
    sum("qty") AS "volume",
    count(*) AS "trade_count"
FROM "trades"
GROUP BY "market_id", "bucket"
WITH NO DATA;

CREATE MATERIALIZED VIEW "candles_5m"
WITH (timescaledb.continuous) AS
SELECT
    "market_id",
    time_bucket(INTERVAL '5 minutes', "executed_at") AS "bucket",
    first("price", "executed_at") AS "open",
    max("price") AS "high",
    min("price") AS "low",
    last("price", "executed_at") AS "close",
    sum("qty") AS "volume",
    count(*) AS "trade_count"
FROM "trades"
GROUP BY "market_id", "bucket"
WITH NO DATA;

CREATE MATERIALIZED VIEW "candles_15m"
WITH (timescaledb.continuous) AS
SELECT
    "market_id",
    time_bucket(INTERVAL '15 minutes', "executed_at") AS "bucket",
    first("price", "executed_at") AS "open",
    max("price") AS "high",
    min("price") AS "low",
    last("price", "executed_at") AS "close",
    sum("qty") AS "volume",
    count(*) AS "trade_count"
FROM "trades"
GROUP BY "market_id", "bucket"
WITH NO DATA;

CREATE MATERIALIZED VIEW "candles_1h"
WITH (timescaledb.continuous) AS
SELECT
    "market_id",
    time_bucket(INTERVAL '1 hour', "executed_at") AS "bucket",
    first("price", "executed_at") AS "open",
    max("price") AS "high",
    min("price") AS "low",
    last("price", "executed_at") AS "close",
    sum("qty") AS "volume",
    count(*) AS "trade_count"
FROM "trades"
GROUP BY "market_id", "bucket"
WITH NO DATA;

CREATE MATERIALIZED VIEW "candles_2h"
WITH (timescaledb.continuous) AS
SELECT
    "market_id",
    time_bucket(INTERVAL '2 hours', "executed_at") AS "bucket",
    first("price", "executed_at") AS "open",
    max("price") AS "high",
    min("price") AS "low",
    last("price", "executed_at") AS "close",
    sum("qty") AS "volume",
    count(*) AS "trade_count"
FROM "trades"
GROUP BY "market_id", "bucket"
WITH NO DATA;

CREATE INDEX "candles_1m_market_id_bucket_idx" ON "candles_1m"("market_id", "bucket" DESC);
CREATE INDEX "candles_5m_market_id_bucket_idx" ON "candles_5m"("market_id", "bucket" DESC);
CREATE INDEX "candles_15m_market_id_bucket_idx" ON "candles_15m"("market_id", "bucket" DESC);
CREATE INDEX "candles_1h_market_id_bucket_idx" ON "candles_1h"("market_id", "bucket" DESC);
CREATE INDEX "candles_2h_market_id_bucket_idx" ON "candles_2h"("market_id", "bucket" DESC);

SELECT add_continuous_aggregate_policy(
    'candles_1m',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute'
);

SELECT add_continuous_aggregate_policy(
    'candles_5m',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '5 minutes'
);

SELECT add_continuous_aggregate_policy(
    'candles_15m',
    start_offset => INTERVAL '14 days',
    end_offset => INTERVAL '15 minutes',
    schedule_interval => INTERVAL '15 minutes'
);

SELECT add_continuous_aggregate_policy(
    'candles_1h',
    start_offset => INTERVAL '30 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);

SELECT add_continuous_aggregate_policy(
    'candles_2h',
    start_offset => INTERVAL '30 days',
    end_offset => INTERVAL '2 hours',
    schedule_interval => INTERVAL '2 hours'
);
