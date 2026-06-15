# db

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

## Timescale candle setup

Run the normal Prisma database setup first so tables like `Market`, `Orders`,
and `Fills` exist. Then run the Timescale schema against a PostgreSQL server
that has TimescaleDB installed:

```bash
bun setup.ts
```

You can also pass the database URL directly:

```bash
bun setup.ts "postgres://postgres:your_secure_password@localhost:5432/mydb"
```

This creates the `trades` hypertable and the candle continuous aggregates:

```text
candles_1m
candles_5m
candles_15m
candles_1h
candles_2h
```

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
