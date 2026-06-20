import { createClient, Type } from "@repo/redis_data";
import { randomUUID } from "crypto";

const MARKETS = [
  { name: "SOL_USDC", basePrice: 22.45 },
  { name: "BTC_USDC", basePrice: 96420 },
  { name: "ETH_USDC", basePrice: 3120 },
];

const BOT_BUYER = "dummy-bot-buyer-001";
const BOT_SELLER = "dummy-bot-seller-001";
const LEVERAGE = 10;
const DEPTH_LEVELS = 8;
const BASE_QTY = 5;
const LEVEL_SPREAD = 0.0025; // 0.25% per level

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function push(client: Awaited<ReturnType<typeof createClient>>, data: object) {
  await client.xAdd("input_stream", "*", { data: JSON.stringify(data) });
}

async function initBots(client: Awaited<ReturnType<typeof createClient>>) {
  for (const userId of [BOT_BUYER, BOT_SELLER]) {
    await push(client, { type: Type.INITIALIZE_BALANCE, userId, loopbackid: randomUUID() });
    await sleep(80);
    // 100 million USDC so the bots never run out
    await push(client, { type: Type.ON_RAMP, userId, amount: 100_000_000, loopbackid: randomUUID() });
    await sleep(120);
  }
  console.log("Bots initialised with balances.");
}

async function seedBook(
  client: Awaited<ReturnType<typeof createClient>>,
  market: string,
  basePrice: number,
) {
  // LONG (bid) side — buyer places buy-side resting orders
  for (let i = 1; i <= DEPTH_LEVELS; i++) {
    const price = parseFloat((basePrice * (1 - LEVEL_SPREAD * i)).toFixed(4));
    const qty = BASE_QTY + Math.floor(Math.random() * 10);
    await push(client, {
      type: Type.CREATE_ORDER,
      userId: BOT_BUYER,
      market,
      side: "LONG",
      price,
      qty,
      leverage: LEVERAGE,
      ordertype: "Limit",
      loopbackid: randomUUID(),
    });
    await sleep(40);
  }

  // SHORT (ask) side — seller places sell-side resting orders
  for (let i = 1; i <= DEPTH_LEVELS; i++) {
    const price = parseFloat((basePrice * (1 + LEVEL_SPREAD * i)).toFixed(4));
    const qty = BASE_QTY + Math.floor(Math.random() * 10);
    await push(client, {
      type: Type.CREATE_ORDER,
      userId: BOT_SELLER,
      market,
      side: "SHORT",
      price,
      qty,
      leverage: LEVERAGE,
      ordertype: "Limit",
      loopbackid: randomUUID(),
    });
    await sleep(40);
  }
}

async function tick(
  client: Awaited<ReturnType<typeof createClient>>,
  market: string,
  basePrice: number,
) {
  // Alternate between a market LONG and market SHORT to generate fills
  const takeSide: "LONG" | "SHORT" = Math.random() > 0.5 ? "LONG" : "SHORT";
  const userId = takeSide === "LONG" ? BOT_BUYER : BOT_SELLER;
  const fillQty = Math.floor(Math.random() * 4) + 1;

  await push(client, {
    type: Type.CREATE_ORDER,
    userId,
    market,
    side: takeSide,
    price: null,
    qty: fillQty,
    leverage: LEVERAGE,
    ordertype: "Market",
    loopbackid: randomUUID(),
  });
  await sleep(50);

  // Replenish the consumed side with a fresh limit order near the spread
  const offsetPct = LEVEL_SPREAD * (1 + Math.random() * 3);
  if (takeSide === "LONG") {
    // LONG market ate some SHORT asks — add more SHORT ask resting orders
    const price = parseFloat((basePrice * (1 + offsetPct)).toFixed(4));
    await push(client, {
      type: Type.CREATE_ORDER,
      userId: BOT_SELLER,
      market,
      side: "SHORT",
      price,
      qty: BASE_QTY + Math.floor(Math.random() * 8),
      leverage: LEVERAGE,
      ordertype: "Limit",
      loopbackid: randomUUID(),
    });
  } else {
    // SHORT market ate some LONG bids — add more LONG bid resting orders
    const price = parseFloat((basePrice * (1 - offsetPct)).toFixed(4));
    await push(client, {
      type: Type.CREATE_ORDER,
      userId: BOT_BUYER,
      market,
      side: "LONG",
      price,
      qty: BASE_QTY + Math.floor(Math.random() * 8),
      leverage: LEVERAGE,
      ordertype: "Limit",
      loopbackid: randomUUID(),
    });
  }
}

async function main() {
  console.log("Connecting to Redis...");
  const client = await createClient();
  console.log("Connected.");

  await initBots(client);

  console.log("Seeding initial order books for all markets...");
  for (const { name, basePrice } of MARKETS) {
    console.log(`  Seeding ${name}`);
    await seedBook(client, name, basePrice);
  }
  console.log("All markets seeded. Starting tick loop (Ctrl+C to stop)...");

  let tickCount = 0;
  while (true) {
    // Pick a random market each tick
    const market = MARKETS[Math.floor(Math.random() * MARKETS.length)]!;
    await tick(client, market.name, market.basePrice);

    tickCount++;
    // Every 30 ticks, re-seed all markets to keep the book deep
    if (tickCount % 30 === 0) {
      for (const { name, basePrice } of MARKETS) {
        await seedBook(client, name, basePrice);
      }
      console.log(`[tick ${tickCount}] books replenished.`);
    }

    // 700ms–1.4s between ticks so depth changes are visible in the UI
    await sleep(700 + Math.floor(Math.random() * 700));
  }
}

main().catch((err) => {
  console.error("Dummy order simulator crashed:", err);
  process.exit(1);
});
