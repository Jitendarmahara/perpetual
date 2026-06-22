import { createClient } from "@repo/redis_data";
import type {
  ToEngineOnRamp,
  FromEngineOnRamp,
  PriceData,
} from "@repo/redis_data";
import {
  Type,
  type ToEngineCreateMarket,
} from "../../packages/redis_data/types/types";
import { OnRamp, initalizedBalnce, initalizedMarket } from "./utils/onramp";
import { Balance, Orderbook } from "./stor/echangestore";
import { CheckForLiqudation } from "./utils/liqudation";
import { CalculateFundingRate } from "./utils/fundingrate";
import {
  CreateOrder,
  PublishEngineEvents,
} from "./utils/matchorder";
import { DeleteOrder, OpenOrders } from "./utils/orders";
import { OpenPositions } from "./utils/positionupdate";
import { GetDepth } from "./utils/getdepth";
import { loadSnapshot, takeSnapshot, replayState } from "./utils/snapshot";
export const redisclient = await createClient();

// Pre-create market slots — prices start at 0 and are set by the price poller
initalizedMarket("SOL_USDC", 0, 0);
initalizedMarket("BTC_USDC", 0, 0);
initalizedMarket("ETH_USDC", 0, 0);

// Restore Orderbook/Balance/Position from the last snapshot, if one exists.
const lastSnapshotId = await loadSnapshot();

// Throttle map so PRICE events are broadcast at most once per 2s per market
const lastPriceBroadcast: Record<string, number> = {};
const PRICE_BROADCAST_MS = 500;

type StreamResponse = {
  name: string;
  messages: {
    id: string;
    message: Record<string, string>;
  }[];
}[];

// Single chokepoint for direct events_stream writes — stays silent during replay.
async function publishEvent(data: Record<string, unknown>) {
  if (replayState.active) return;
  await redisclient.xAdd("events_stream", "*", { data: JSON.stringify(data) });
}

async function processMessage(parsed: any) {
  if (parsed.type === Type.INITIALIZE_BALANCE) {
    const data = parsed as ToEngineOnRamp;
    await initalizedBalnce(data.userId);
    await publishEvent({
      type: Type.INITIALIZE_BALANCE,
      success: true,
      amount: 0,
      loopbackid: data.loopbackid,
      userId: data.userId,
    });
  } else if (parsed.type === Type.ON_RAMP) {
    const data = parsed as ToEngineOnRamp;
    const result = await OnRamp(data.userId, data.amount);

    await publishEvent({
      type: Type.ON_RAMP,
      success: result.success,
      amount: result.amount ?? 0,
      loopbackid: data.loopbackid,
      error: result.error,
      userId: data.userId,
      balance: Balance.get(data.userId),
    });
  } else if (parsed.type === Type.INITIALIZE_MARKET) {
    const data = parsed as ToEngineCreateMarket;
    const result = initalizedMarket(
      data.market,
      data.lastTradedPrice,
      data.indexprice,
    );

    await publishEvent({
      type: Type.INITIALIZE_MARKET,
      success: result.success,
      error: result.error,
      market: data.market,
      lastTradedPrice: data.lastTradedPrice,
      indexprice: data.indexprice,
      loopbackid: data.loopbackid,
    });
  } else if (parsed.type === Type.PRICE) {
    const data = parsed as PriceData;

    const book = Orderbook.get(data.market);
    if (book) {
      book.indexprice = data.price;
      // Seed lastTradedPrice from the poller until the first real fill sets it
      if (book.lastTradedPrice === 0) {
        book.lastTradedPrice = data.price;
      }
    }

    await CheckForLiqudation(data.market, data.price);

    // Throttled broadcast so the frontend header shows the live price
    const now = Date.now();
    if (now - (lastPriceBroadcast[data.market] ?? 0) >= PRICE_BROADCAST_MS) {
      lastPriceBroadcast[data.market] = now;
      await publishEvent({
        type: Type.PRICE,
        market: data.market,
        price: data.price,
      });
    }
  } else if (parsed.type === Type.CREATE_ORDER) {
    const data = parsed;
    const result = CreateOrder(
      data.userId,
      data.qty,
      data.leverage,
      data.price,
      data.side,
      data.market,
      data.ordertype,
    );
    if ("events" in result) {
      await PublishEngineEvents(result.events);
    }

    const responseData =
      "events" in result
        ? {
            type: Type.CREATE_ORDER,
            success: true,
            executedqty: result.executedqty,
            remaningqty: result.remaningqty,
            loopbackid: data.loopbackid,
          }
        : {
            type: Type.CREATE_ORDER,
            success: false,
            error: result.error,
            loopbackid: data.loopbackid,
          };

    await publishEvent(responseData);
  } else if (parsed.type === Type.CANCLE_ORDER) {
    const data = parsed;
    const result = DeleteOrder(data.orderId, data.userId, data.market);

    await publishEvent({
      type: Type.CANCLE_ORDER,
      success: result.success,
      orderId: data.orderId,
      market: data.market,
      data: result.data,
      error: result.error,
      bids: "side" in result && result.side === "bid" ? [[result.price.toString(), result.remainingQty.toString()]] : undefined,
      asks: "side" in result && result.side === "ask" ? [[result.price.toString(), result.remainingQty.toString()]] : undefined,
      loopbackid: data.loopbackid,
    });
  } else if (parsed.type === Type.GET_ORDER) {
    const data = parsed;
    const result = OpenOrders(data.market, data.userId);

    await publishEvent({
      type: Type.GET_ORDER,
      success: result.success,
      orders: result.orders,
      error: result.error,
      loopbackid: data.loopbackid,
    });
  } else if (parsed.type === Type.GET_BALANCE) {
    const data = parsed;
    const balance = Balance.get(data.userId) || {
      available: 0,
      locked: 0,
    };

    await publishEvent({
      type: Type.GET_BALANCE,
      success: true,
      balance,
      loopbackid: data.loopbackid,
    });
  } else if (parsed.type === Type.GET_DEPTH) {
    const data = parsed;
    const result = GetDepth(data.market);

    await publishEvent({
      type: Type.GET_DEPTH,
      success: result.success,
      bids: result.bids,
      asks: result.asks,
      markPrice: "markPrice" in result ? result.markPrice : undefined,
      lastTradedPrice: "lastTradedPrice" in result ? result.lastTradedPrice : undefined,
      error: result.error,
      loopbackid: data.loopbackid,
    });
  } else if (parsed.type === Type.GET_POSITION) {
    const data = parsed;
    const result = OpenPositions(data.userId, data.market);

    await publishEvent({
      type: Type.GET_POSITION,
      success: result.success,
      position: result.position,
      error: result.error,
      loopbackid: data.loopbackid,
    });
  }
}

let lastId = lastSnapshotId ?? "$";

// Replay everything that landed on input_stream after the snapshot but
// before the crash, silently (replayState.active suppresses publishing),
// before falling through to the live loop below.
if (lastId !== "$") {
  replayState.active = true;
  while (true) {
    const backlog = (await redisclient.xRange(
      "input_stream",
      `(${lastId}`,
      "+",
      { COUNT: 1000 },
    )) as unknown as { id: string; message: Record<string, string> }[];
    if (backlog.length === 0) break;
    for (const msg of backlog) {
      lastId = msg.id;
      await processMessage(JSON.parse(msg.message.data!));
    }
  }
  replayState.active = false;
}

setInterval(() => {
  void takeSnapshot(lastId);
}, 10_000);

async function MessageChecker() {
  while (true) {
    const respone = (await redisclient.xRead(
      [{ key: "input_stream", id: lastId }],
      { BLOCK: 0 },
    )) as unknown as StreamResponse | null;
    if (!respone) continue;

    for (const stream of respone) {
      for (const msg of stream.messages) {
        lastId = msg.id;
        await processMessage(JSON.parse(msg.message.data!));
      }
    }
  }
}
setInterval(CalculateFundingRate, 1 * 60 * 60 * 1000);
MessageChecker();

