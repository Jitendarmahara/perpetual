import { randomUUID } from "crypto";
import { WebSocket } from "ws";
import { createClient, Type } from "@repo/redis_data";

type RedisClient = Awaited<ReturnType<typeof createClient>>;

export type MarketSymbol = "SOL_USDC" | "BTC_USDC" | "ETH_USDC";

export type MarketConfig = {
  name: MarketSymbol;
  fallbackPrice: number;
  tickSize: number;
  quoteQty: number;
  tradeQty: number;
  spreadBps: number;
  outerBps: number;
};

export type QuoteLevel = {
  price: number;
  qty: number;
};

export const MARKET_CONFIGS: MarketConfig[] = [
  {
    name: "SOL_USDC",
    fallbackPrice: 73,
    tickSize: 0.01,
    quoteQty: 24,
    tradeQty: 3,
    spreadBps: 8,
    outerBps: 22,
  },
  {
    name: "BTC_USDC",
    fallbackPrice: 59_000,
    tickSize: 0.5,
    quoteQty: 0.12,
    tradeQty: 0.015,
    spreadBps: 5,
    outerBps: 16,
  },
  {
    name: "ETH_USDC",
    fallbackPrice: 1_575,
    tickSize: 0.05,
    quoteQty: 1.6,
    tradeQty: 0.22,
    spreadBps: 7,
    outerBps: 18,
  },
];

const BINANCE_REST_URL =
  "https://api.binance.com/api/v3/ticker/price?symbols=%5B%22SOLUSDT%22,%22BTCUSDT%22,%22ETHUSDT%22%5D";
const BINANCE_WS_URL =
  "wss://stream.binance.com:9443/stream?streams=solusdt@trade/btcusdt@trade/ethusdt@trade";
const BINANCE_SYMBOL_TO_MARKET: Record<string, MarketSymbol> = {
  SOLUSDT: "SOL_USDC",
  BTCUSDT: "BTC_USDC",
  ETHUSDT: "ETH_USDC",
};
const LEVELS = 12;
const LEVERAGE = 10;
const BOT_BALANCE = 1_000_000_000_000;
const PRICE_WAIT_MS = 12_000;
const TICK_MS = 650;

// Per-market synthetic price state — drives candle movement independently of Binance feed
const syntheticMids = new Map<MarketSymbol, number>();
const momentums    = new Map<MarketSymbol, number>();

function stepMarketState(
  config: MarketConfig,
  realPrice: number,
): { syntheticMid: number; side: "LONG" | "SHORT" } {
  const prevMid = syntheticMids.get(config.name) ?? realPrice;
  const prevMom = momentums.get(config.name) ?? 0;

  // Momentum: random shock + decay → creates runs of buying or selling
  const newMom = Math.max(-1, Math.min(1, prevMom * 0.82 + (Math.random() - 0.5) * 0.65));
  momentums.set(config.name, newMom);

  // Synthetic mid: momentum drift + small noise + slow reversion toward real Binance price
  const drift     = newMom * realPrice * 0.0008;
  const noise     = (Math.random() - 0.5) * realPrice * 0.0003;
  const reversion = (realPrice - prevMid) * 0.015;
  const newMid    = roundToTick(
    Math.max(realPrice * 0.85, Math.min(realPrice * 1.15, prevMid + drift + noise + reversion)),
    config.tickSize,
  );
  syntheticMids.set(config.name, newMid);

  // Side biased by momentum so the market actually trends up or down
  const pLong: number = 0.5 + newMom * 0.35;
  const side: "LONG" | "SHORT" = Math.random() < pLong ? "LONG" : "SHORT";

  return { syntheticMid: newMid, side };
}

const BOTS = {
  bidMaker: "market-process-bid-maker",
  askMaker: "market-process-ask-maker",
  longTaker: "market-process-long-taker",
  shortTaker: "market-process-short-taker",
};

type LivePrices = Map<MarketSymbol, number>;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decimalPlaces(value: number) {
  const [, decimals = ""] = value.toString().split(".");
  return decimals.length;
}

export function roundToTick(price: number, tickSize: number) {
  const places = decimalPlaces(tickSize);
  return Number((Math.round(price / tickSize) * tickSize).toFixed(places));
}

export function priceForMarket(
  config: MarketConfig,
  livePrices: ReadonlyMap<MarketSymbol, number>,
) {
  return livePrices.get(config.name) ?? config.fallbackPrice;
}

export function buildQuoteLadder(
  config: MarketConfig,
  midPrice: number,
  levels = LEVELS,
) {
  const bids: QuoteLevel[] = [];
  const asks: QuoteLevel[] = [];

  for (let level = 1; level <= levels; level++) {
    const levelBps = config.spreadBps + config.outerBps * (level - 1);
    const qty = Number((config.quoteQty * (1 + level * 0.1)).toFixed(6));

    bids.push({
      price: roundToTick(midPrice * (1 - levelBps / 10_000), config.tickSize),
      qty,
    });
    asks.push({
      price: roundToTick(midPrice * (1 + levelBps / 10_000), config.tickSize),
      qty,
    });
  }

  return { bids, asks };
}

async function fetchInitialPrices(livePrices: LivePrices) {
  try {
    const response = await fetch(BINANCE_REST_URL);
    if (!response.ok) return;

    const rows = (await response.json()) as {
      symbol?: string;
      price?: string | number;
    }[];

    for (const row of rows) {
      const market = row.symbol ? BINANCE_SYMBOL_TO_MARKET[row.symbol] : undefined;
      const price = Number(row.price);
      if (market && Number.isFinite(price) && price > 0) {
        livePrices.set(market, price);
      }
    }
  } catch {
    // The websocket/fallback prices will take over if the snapshot fails.
  }
}

function parseBinanceTrade(raw: string) {
  const parsed = JSON.parse(raw) as {
    data?: {
      s?: string;
      p?: string | number;
    };
  };
  const symbol = parsed.data?.s?.toUpperCase();
  const market = symbol ? BINANCE_SYMBOL_TO_MARKET[symbol] : undefined;
  const price = Number(parsed.data?.p);

  if (!market) {
    return null;
  }

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  return { market, price };
}

function startPriceFeed(livePrices: LivePrices) {
  let id = 1;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    const ws = new WebSocket(BINANCE_WS_URL);

    ws.on("open", () => {
      id++;
      console.log("market process connected to Binance trade feed");
    });

    ws.on("message", (message) => {
      try {
        const trade = parseBinanceTrade(message.toString());
        if (trade) {
          livePrices.set(trade.market, trade.price);
        }
      } catch {
        // Ignore non-trade messages from the exchange feed.
      }
    });

    ws.on("close", () => {
      reconnectTimer = setTimeout(connect, 2_000);
    });

    ws.on("error", () => {
      ws.close();
    });
  };

  connect();

  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
  };
}

async function waitForInitialPrices(livePrices: LivePrices) {
  const deadline = Date.now() + PRICE_WAIT_MS;
  while (Date.now() < deadline) {
    const ready = MARKET_CONFIGS.every((config) => livePrices.has(config.name));
    if (ready) return;
    await sleep(250);
  }
}

async function push(client: RedisClient, data: Record<string, unknown>) {
  await client.xAdd("input_stream", "*", { data: JSON.stringify(data) });
}

async function initializeBots(client: RedisClient) {
  for (const userId of Object.values(BOTS)) {
    await push(client, {
      type: Type.INITIALIZE_BALANCE,
      userId,
      loopbackid: randomUUID(),
    });
    await sleep(40);
    await push(client, {
      type: Type.ON_RAMP,
      userId,
      amount: BOT_BALANCE,
      loopbackid: randomUUID(),
    });
    await sleep(40);
  }
}

async function publishPrice(
  client: RedisClient,
  market: MarketSymbol,
  price: number,
) {
  await push(client, {
    type: Type.PRICE,
    market,
    price,
  });
}

async function placeLimitOrder(
  client: RedisClient,
  market: MarketSymbol,
  userId: string,
  side: "LONG" | "SHORT",
  level: QuoteLevel,
) {
  await push(client, {
    type: Type.CREATE_ORDER,
    userId,
    market,
    side,
    price: level.price,
    qty: level.qty,
    leverage: LEVERAGE,
    ordertype: "Limit",
    loopbackid: randomUUID(),
  });
}

async function seedLadder(
  client: RedisClient,
  config: MarketConfig,
  midPrice: number,
  levels = LEVELS,
) {
  const { bids, asks } = buildQuoteLadder(config, midPrice, levels);

  for (const bid of bids) {
    await placeLimitOrder(client, config.name, BOTS.bidMaker, "LONG", bid);
    await sleep(15);
  }

  for (const ask of asks) {
    await placeLimitOrder(client, config.name, BOTS.askMaker, "SHORT", ask);
    await sleep(15);
  }
}

async function placeMarketTrade(
  client: RedisClient,
  config: MarketConfig,
  side: "LONG" | "SHORT",
) {
  // Larger orders (3–7x) eat through seed book levels, forcing the price to move
  const qtyMultiplier = 3 + Math.random() * 4;
  await push(client, {
    type: Type.CREATE_ORDER,
    userId: side === "LONG" ? BOTS.longTaker : BOTS.shortTaker,
    market: config.name,
    side,
    price: null,
    qty: Number((config.tradeQty * qtyMultiplier).toFixed(6)),
    leverage: LEVERAGE,
    ordertype: "Market",
    loopbackid: randomUUID(),
  });
}

async function runMarketTick(
  client: RedisClient,
  config: MarketConfig,
  livePrices: LivePrices,
) {
  const realPrice = priceForMarket(config, livePrices);
  await publishPrice(client, config.name, realPrice);

  const { syntheticMid, side } = stepMarketState(config, realPrice);

  // Two market orders in the same direction each tick — burns through book levels
  // so fill prices follow the synthetic mid instead of staying pinned to the spread
  await placeMarketTrade(client, config, side);
  await sleep(8);
  await placeMarketTrade(client, config, side);

  // Replenish top-of-book around the drifting synthetic mid, not the static real price
  const { bids, asks } = buildQuoteLadder(config, syntheticMid, 2);
  await placeLimitOrder(client, config.name, BOTS.bidMaker, "LONG", bids[0]!);
  await placeLimitOrder(client, config.name, BOTS.askMaker, "SHORT", asks[0]!);
}

export async function startMarketProcess() {
  const livePrices: LivePrices = new Map();
  await fetchInitialPrices(livePrices);
  startPriceFeed(livePrices);

  console.log("market process waiting for live prices...");
  await waitForInitialPrices(livePrices);

  const priceSummary = MARKET_CONFIGS.map((config) => {
    const price = priceForMarket(config, livePrices);
    return `${config.name}=${price}`;
  }).join(" ");
  console.log(`market process prices: ${priceSummary}`);

  console.log("market process connecting to Redis...");
  const client = await createClient();
  console.log("market process connected");

  await initializeBots(client);

  for (const config of MARKET_CONFIGS) {
    const price = priceForMarket(config, livePrices);
    await publishPrice(client, config.name, price);
    await seedLadder(client, config, price);
    console.log(`seeded ${config.name} near ${price}`);
  }

  let tick = 0;
  while (true) {
    const config = MARKET_CONFIGS[tick % MARKET_CONFIGS.length]!;
    await runMarketTick(client, config, livePrices);

    tick++;
    if (tick % (MARKET_CONFIGS.length * 20) === 0) {
      for (const marketConfig of MARKET_CONFIGS) {
        // Seed around the current synthetic mid so depth tracks where price actually is
        await seedLadder(
          client,
          marketConfig,
          syntheticMids.get(marketConfig.name) ?? priceForMarket(marketConfig, livePrices),
          4,
        );
      }
      console.log(`[tick ${tick}] refreshed all market ladders`);
    }

    await sleep(TICK_MS);
  }
}
