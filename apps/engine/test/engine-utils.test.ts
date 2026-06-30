import { beforeEach, describe, expect, test } from "bun:test";
import { Balance, Orderbook, Position } from "../stor/echangestore";
import type { openOrders } from "../types/types";
import { ADL } from "../utils/autodeleverage";
import { GetDepth } from "../utils/getdepth";
import { CreateOrder, LiqudationPrice } from "../utils/matchorder";
import { DeleteOrder, OpenOrders } from "../utils/orders";
import { CheckPositionUpdates } from "../utils/positionupdate";
import { Type } from "@repo/redis_data";
import { LiquidatePosition } from "../utils/liqudation";
import { replayState } from "../utils/snapshot";

// Suppress Redis publishing in unit tests — replayState.active is the
// built-in bypass used during crash recovery replay.
replayState.active = true;

beforeEach(() => {
  Balance.clear();
  Orderbook.clear();
  Position.clear();
});

function seedBalance(userId: string, available = 100_000, locked = 0) {
  Balance.set(userId, { available, locked });
}

function makeOrder(
  overrides: Partial<openOrders> & Pick<openOrders, "userId" | "orderId">,
): openOrders {
  return {
    qty: 10,
    filledQty: 0,
    createdAt: new Date(),
    leverage: 10,
    ...overrides,
  };
}

function seedBook(
  market: string,
  bids: [number, number, openOrders[]?][] = [],
  asks: [number, number, openOrders[]?][] = [],
) {
  Orderbook.set(market, {
    bids: new Map(
      bids.map(([price, availableQty, openOrders]) => [
        price,
        {
          availableQty,
          openOrders: openOrders ?? [
            makeOrder({ userId: "maker", orderId: `bid-${price}` }),
          ],
        },
      ]),
    ),
    asks: new Map(
      asks.map(([price, availableQty, openOrders]) => [
        price,
        {
          availableQty,
          openOrders: openOrders ?? [
            makeOrder({ userId: "maker", orderId: `ask-${price}` }),
          ],
        },
      ]),
    ),
    lastTradedPrice: 100,
    indexprice: 100,
  });
}

function seedPosition(
  userId: string,
  market: string,
  type: "LONG" | "SHORT",
  qty: number,
  price: number,
  leverage: number,
) {
  const userPositions = Position.get(userId) ?? new Map();
  userPositions.set(market, {
    market,
    type,
    qty,
    averagePrice: price,
    liquidationPrice: LiqudationPrice(leverage, qty, price, type),
    margin: (price * qty) / leverage,
    leverage,
  });
  Position.set(userId, userPositions);
}

describe("GetDepth", () => {
  test("returns sorted non-zero bid and ask levels", () => {
    seedBook(
      "BTC",
      [
        [100, 4],
        [99, 0],
        [101, 2],
      ],
      [
        [105, 3],
        [106, 0],
        [104, 1],
      ],
    );

    const result = GetDepth("BTC");

    expect(result.success).toBe(true);
    expect(result.bids).toEqual([
      [101, 2],
      [100, 4],
    ]);
    expect(result.asks).toEqual([
      [104, 1],
      [105, 3],
    ]);
  });

  test("returns an error for unknown markets", () => {
    expect(GetDepth("MISSING")).toEqual({
      success: false,
      error: "orderbook not found",
    });
  });
});

describe("OpenOrders and DeleteOrder", () => {
  test("OpenOrders returns only the requested user's orders from both sides", () => {
    seedBook(
      "BTC",
      [
        [
          99,
          5,
          [
            makeOrder({ userId: "user1", orderId: "bid-user1", qty: 5 }),
            makeOrder({ userId: "user2", orderId: "bid-user2", qty: 3 }),
          ],
        ],
      ],
      [
        [
          105,
          2,
          [makeOrder({ userId: "user1", orderId: "ask-user1", qty: 2 })],
        ],
      ],
    );

    const result = OpenOrders("BTC", "user1");

    expect(result.success).toBe(true);
    if (!result.orders) throw new Error("expected open orders");

    expect(result.orders).toHaveLength(2);
    expect(result.orders.map((order) => order.orderId).sort()).toEqual([
      "ask-user1",
      "bid-user1",
    ]);
  });

  test("DeleteOrder refunds only remaining margin and removes an empty ask level", () => {
    seedBalance("user1", 100, 50);
    seedBook(
      "BTC",
      [],
      [
        [
          105,
          6,
          [
            makeOrder({
              userId: "user1",
              orderId: "ask-1",
              qty: 10,
              filledQty: 4,
              marginLocked: 50,
            }),
          ],
        ],
      ],
    );

    const result = DeleteOrder("ask-1", "user1", "BTC");

    expect(result.success).toBe(true);
    expect(Orderbook.get("BTC")!.asks.has(105)).toBe(false);
    expect(Balance.get("user1")!.available).toBe(130);
    expect(Balance.get("user1")!.locked).toBe(20);
  });

  test("DeleteOrder does not let a different user cancel an order", () => {
    seedBalance("user1", 100, 50);
    seedBalance("attacker", 100, 0);
    seedBook(
      "BTC",
      [],
      [
        [
          105,
          10,
          [makeOrder({ userId: "user1", orderId: "ask-1", marginLocked: 50 })],
        ],
      ],
    );

    const result = DeleteOrder("ask-1", "attacker", "BTC");

    expect(result.success).toBe(false);
    expect(result.error).toBe("order not found");
    expect(Orderbook.get("BTC")!.asks.get(105)!.availableQty).toBe(10);
    expect(Balance.get("user1")).toEqual({ available: 100, locked: 50 });
    expect(Balance.get("attacker")).toEqual({ available: 100, locked: 0 });
  });
});

describe("CreateOrder events and leverage handling", () => {
  test("returns order-created and fill events without publishing them directly", () => {
    seedBalance("taker", 100_000);
    seedBalance("maker", 100_000);
    seedBook("BTC", [], [[100, 5]]);

    const result = CreateOrder("taker", 5, 10, null, "LONG", "BTC", "Market");

    if ("error" in result) throw new Error(result.error);

    expect(result.success).toBe(true);
    expect(result.events).toHaveLength(2);
    const createEvent = result.events[0];
    const fillEventPayload = result.events[1];
    if (!createEvent || !fillEventPayload) {
      throw new Error("expected create and fill events");
    }

    expect(createEvent.type).toBe(Type.CREATE_ORDER);
    expect(fillEventPayload.type).toBe(Type.FILL);

    const createdOrder = createEvent.order as { id: string };
    const fillEvent = fillEventPayload as {
      fills: { taker_order_id: string; maker_order_id: string }[];
      orderUpdates: { orderId: string; status: string }[];
    };
    expect(fillEvent.fills[0]).toMatchObject({
      taker_order_id: createdOrder.id,
      maker_order_id: "ask-100",
    });
    expect(fillEvent.orderUpdates[0]).toMatchObject({
      orderId: createdOrder.id,
      status: "filled",
    });
  });

  test("updates last traded price to the fill price", () => {
    seedBalance("taker", 100_000);
    seedBalance("maker", 100_000);
    seedBook("BTC", [], [[105, 2]]);

    const result = CreateOrder("taker", 2, 10, null, "LONG", "BTC", "Market");

    expect(result.success).toBe(true);
    expect(Orderbook.get("BTC")!.lastTradedPrice).toBe(105);
  });

  test("uses maker resting-order leverage when updating maker position", () => {
    seedBalance("taker", 100_000);
    seedBalance("maker", 100_000);
    seedBook(
      "BTC",
      [],
      [
        [
          100,
          10,
          [
            makeOrder({
              userId: "maker",
              orderId: "ask-1",
              qty: 10,
              leverage: 5,
            }),
          ],
        ],
      ],
    );

    const result = CreateOrder("taker", 10, 10, null, "LONG", "BTC", "Market");

    expect(result.success).toBe(true);
    expect(Position.get("maker")!.get("BTC")!.margin).toBe(200);
    expect(Position.get("maker")!.get("BTC")!.leverage).toBe(5);
  });
});

describe("Position leverage and ADL", () => {
  test("partial close keeps the existing position leverage for liquidation price", () => {
    seedBalance("user1", 100_000, 200);
    seedPosition("user1", "BTC", "LONG", 10, 100, 5);

    const result = CheckPositionUpdates("user1", "BTC", "SHORT", 110, 4, 20);

    expect(result?.success).toBe(true);
    const remaining = Position.get("user1")!.get("BTC")!;
    expect(remaining.qty).toBe(6);
    expect(remaining.leverage).toBe(5);
    expect(remaining.liquidationPrice).toBe(85);
  });

  test("ADL closes against profitable opposite-side positions by priority", () => {
    seedBalance("liquidated", 0, 100);
    seedBalance("target-high", 1_000, 100);
    seedBalance("target-low", 1_000, 100);
    seedPosition("liquidated", "BTC", "LONG", 3, 100, 10);
    seedPosition("target-low", "BTC", "SHORT", 10, 100, 5);
    seedPosition("target-high", "BTC", "SHORT", 10, 100, 20);

    const result = ADL("BTC", "liquidated", "LONG", 3, 80);

    expect(result.success).toBe(true);
    expect(result.executedqty).toBe(3);
    expect(Position.get("liquidated")!.has("BTC")).toBe(false);
    expect(Position.get("target-high")!.get("BTC")!.qty).toBe(7);
    expect(Position.get("target-low")!.get("BTC")!.qty).toBe(10);
  });

  test("ADL reports insurance-fund path when opposite liquidity is insufficient", () => {
    seedBalance("liquidated", 0, 100);
    seedBalance("target", 1_000, 100);
    seedPosition("liquidated", "BTC", "LONG", 10, 100, 10);
    seedPosition("target", "BTC", "SHORT", 4, 100, 10);

    const result = ADL("BTC", "liquidated", "LONG", 10, 80);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Insurance fund will take care of this loss");
    expect(Position.get("liquidated")!.has("BTC")).toBe(true);
  });

  test("liquidation uses ADL for remaining quantity after partial book fill", async () => {
    seedBalance("liquidated", 0, 100);
    seedBalance("target", 1_000, 100);
    seedBalance("bidder", 1_000, 0);
    seedPosition("liquidated", "BTC", "LONG", 10, 100, 10);
    seedPosition("target", "BTC", "SHORT", 10, 100, 20);
    seedBook(
      "BTC",
      [
        [
          80,
          2,
          [
            makeOrder({
              userId: "bidder",
              orderId: "bid-80",
              qty: 2,
              leverage: 10,
            }),
          ],
        ],
      ],
      [],
    );

    const position = Position.get("liquidated")!.get("BTC")!;
    await LiquidatePosition(80, "BTC", position, "liquidated");

    expect(Position.get("liquidated")!.has("BTC")).toBe(false);
    expect(Position.get("target")!.get("BTC")!.qty).toBe(2);
    expect(Position.get("bidder")!.get("BTC")!.qty).toBe(2);
  });
});
