import { describe, test, expect, beforeEach } from "bun:test";
import { Balance, Orderbook, Position } from "../stor/echangestore";
import {
  UserBalanceLock,
  CreateOrder,
  LiqudationPrice,
  CalculateAveragePrice,
} from "../utils/matchorder";
import { CheckPositionUpdates } from "../utils/positionupdate";
import { OnRamp, initalizedBalnce } from "../utils/onramp";
import {
  Pnl,
  LiquidatePosition,
  CheckForLiqudation,
} from "../utils/liqudation";
import type { openOrders } from "../types/types";

type CreateOrderResult = ReturnType<typeof CreateOrder>;
type CreateOrderSuccess = Exclude<CreateOrderResult, { error: string }>;
type CreateOrderFailure = Extract<CreateOrderResult, { error: string }>;

beforeEach(() => {
  Balance.clear();
  Orderbook.clear();
  Position.clear();
});

function seedBalance(userId: string, available: number, locked: number = 0) {
  Balance.set(userId, { available, locked });
}

function seedOrderbook(
  market: string,
  lastTradedPrice: number,
  bids: [number, number, openOrders[]?][] = [],
  asks: [number, number, openOrders[]?][] = [],
) {
  const bidsMap = new Map<
    number,
    { availableQty: number; openOrders: openOrders[] }
  >();
  const asksMap = new Map<
    number,
    { availableQty: number; openOrders: openOrders[] }
  >();

  const seedMakerBalance = (uid: string) => {
    if (!Balance.has(uid)) Balance.set(uid, { available: 1_000_000, locked: 0 });
  };

  for (const [price, qty, orders] of bids) {
    const openOrdersList = orders ?? [
      {
        userId: "maker1",
        qty,
        filledQty: 0,
        orderId: "b-" + price,
        createdAt: new Date(),
        leverage: 10,
      },
    ];
    for (const o of openOrdersList) seedMakerBalance(o.userId);
    bidsMap.set(price, { availableQty: qty, openOrders: openOrdersList });
  }
  for (const [price, qty, orders] of asks) {
    const openOrdersList = orders ?? [
      {
        userId: "maker1",
        qty,
        filledQty: 0,
        orderId: "a-" + price,
        createdAt: new Date(),
        leverage: 10,
      },
    ];
    for (const o of openOrdersList) seedMakerBalance(o.userId);
    asksMap.set(price, { availableQty: qty, openOrders: openOrdersList });
  }

  Orderbook.set(market, {
    bids: bidsMap,
    asks: asksMap,
    lastTradedPrice,
    indexprice: lastTradedPrice,
  });
}

function seedPosition(
  userId: string,
  market: string,
  type: "LONG" | "SHORT",
  qty: number,
  price: number,
  leverage: number,
  margin?: number,
) {
  const avgPrice = price;
  const liqPrice = LiqudationPrice(leverage, qty, price, type);
  const posMargin = margin ?? (price * qty) / leverage;
  let userPos = Position.get(userId);
  if (!userPos) {
    userPos = new Map();
    Position.set(userId, userPos);
  }
  userPos.set(market, {
    market,
    liquidationPrice: liqPrice,
    type,
    qty,
    margin: posMargin,
    averagePrice: avgPrice,
    leverage,
  });
}

function expectCreateOrderSuccess(
  result: CreateOrderResult,
): asserts result is CreateOrderSuccess {
  expect(result.success).toBe(true);
  if ("error" in result) {
    throw new Error(result.error);
  }
}

function expectCreateOrderFailure(
  result: CreateOrderResult,
): asserts result is CreateOrderFailure {
  expect(result.success).toBe(false);
  if (!("error" in result)) {
    throw new Error("expected create order failure");
  }
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

describe("LiqudationPrice", () => {
  const scenarios: {
    leverage: number;
    qty: number;
    price: number;
    type: "LONG" | "SHORT";
    expected: number;
  }[] = [];
  for (const leverage of [1, 2, 3, 5, 10, 20, 50, 100]) {
    for (const price of [100, 500, 1000, 50000]) {
      for (const type of ["LONG", "SHORT"] as const) {
        const liqPart = price / leverage;
        const expected = type === "LONG" ? price - liqPart : price + liqPart;
        scenarios.push({ leverage, qty: 10, price, type, expected });
      }
    }
  }

  test.each(scenarios)(
    "Leverage=$leverage Price=$price Type=$type => $expected",
    ({ leverage, price, type, expected }) => {
      expect(LiqudationPrice(leverage, 10, price, type)).toBeCloseTo(
        expected,
        10,
      );
    },
  );

  test("LONG liquidation price is below entry", () => {
    expect(LiqudationPrice(10, 10, 100, "LONG")).toBe(90);
  });

  test("SHORT liquidation price is above entry", () => {
    expect(LiqudationPrice(10, 10, 100, "SHORT")).toBe(110);
  });

  test("leverage 1 => liq price at 0 for LONG", () => {
    expect(LiqudationPrice(1, 10, 100, "LONG")).toBe(0);
  });

  test("leverage 1 => liq price at 2x for SHORT", () => {
    expect(LiqudationPrice(1, 10, 100, "SHORT")).toBe(200);
  });

  test("price=0 => liq=0 for LONG", () => {
    expect(LiqudationPrice(10, 10, 0, "LONG")).toBe(0);
  });

  test("price=0 => liq=0 for SHORT", () => {
    expect(LiqudationPrice(10, 10, 0, "SHORT")).toBe(0);
  });
});

describe("CalculateAveragePrice", () => {
  const scenarios: {
    qty: number;
    price: number;
    oldAvg: number;
    oldQty: number;
    expected: number;
  }[] = [];
  const prices = [10, 20, 50, 100, 200, 500];
  const qties = [1, 5, 10, 50, 100];

  for (const price of prices) {
    for (const qty of qties) {
      for (const oldAvg of prices) {
        for (const oldQty of qties) {
          if (scenarios.length >= 200) break;
          const expected = (qty * price + oldAvg * oldQty) / (qty + oldQty);
          scenarios.push({ qty, price, oldAvg, oldQty, expected });
        }
        if (scenarios.length >= 200) break;
      }
      if (scenarios.length >= 200) break;
    }
    if (scenarios.length >= 200) break;
  }

  test.each(scenarios)(
    "qty=$qty price=$price oldAvg=$oldAvg oldQty=$oldQty => $expected",
    ({ qty, price, oldAvg, oldQty, expected }) => {
      expect(CalculateAveragePrice(qty, price, oldAvg, oldQty)).toBeCloseTo(
        expected,
        10,
      );
    },
  );

  test("same price => avg equals that price", () => {
    expect(CalculateAveragePrice(10, 100, 100, 10)).toBe(100);
  });
});

// =============================================
// ONRAMP & INITIALIZE BALANCE
// =============================================

describe("initalizedBalnce", () => {
  const userIds = ["user1", "user2", "user3", "user4", "user5"];
  for (const uid of userIds) {
    test(`initializes balance for ${uid}`, async () => {
      expect(Balance.has(uid)).toBe(false);
      await initalizedBalnce(uid);
      expect(Balance.has(uid)).toBe(true);
      expect(Balance.get(uid)!.available).toBe(0);
      expect(Balance.get(uid)!.locked).toBe(0);
    });
  }

  test("is idempotent", async () => {
    await initalizedBalnce("user1");
    await initalizedBalnce("user1");
    expect(Balance.get("user1")!.available).toBe(0);
  });

  test("does not overwrite existing balance", async () => {
    seedBalance("user1", 100, 50);
    await initalizedBalnce("user1");
    expect(Balance.get("user1")!.available).toBe(100);
    expect(Balance.get("user1")!.locked).toBe(50);
  });
});

describe("OnRamp", () => {
  test("auto-initializes balance and deposits if not yet initialized", async () => {
    const result = await OnRamp("user1", 100);
    expect(result.success).toBe(true);
    expect(result.amount).toBe(100);
  });

  const amounts = [
    1, 10, 50, 100, 500, 1000, 10000, 100000, 0.01, 0.5, 99.99, 1234.56,
    999999.99,
  ];
  for (const amount of amounts) {
    test(`adds ${amount} to available balance`, async () => {
      await initalizedBalnce("user1");
      const result = await OnRamp("user1", amount);
      expect(result.success).toBe(true);
      expect(result.amount).toBe(amount);
      expect(Balance.get("user1")!.available).toBe(amount);
    });
  }

  test("accumulates multiple onramps", async () => {
    await initalizedBalnce("user1");
    await OnRamp("user1", 100);
    await OnRamp("user1", 200);
    await OnRamp("user1", 300);
    expect(Balance.get("user1")!.available).toBe(600);
  });

  test("multiple users are independent", async () => {
    await initalizedBalnce("user1");
    await initalizedBalnce("user2");
    await OnRamp("user1", 100);
    await OnRamp("user2", 200);
    expect(Balance.get("user1")!.available).toBe(100);
    expect(Balance.get("user2")!.available).toBe(200);
  });

  test("does not affect locked balance", async () => {
    seedBalance("user1", 50, 30);
    await OnRamp("user1", 100);
    expect(Balance.get("user1")!.available).toBe(150);
    expect(Balance.get("user1")!.locked).toBe(30);
  });
});

// =============================================
// USER BALANCE LOCK
// =============================================

describe("UserBalanceLock - no existing position", () => {
  const leverages = [1, 2, 3, 5, 10, 20, 50, 100];
  for (const leverage of leverages) {
    test(`new LONG position leverage=${leverage} locks correct margin`, () => {
      seedBalance("user1", 10000);
      const result = UserBalanceLock("user1", "LONG", "BTC", 10, 100, leverage);
      expect(result.success).toBe(true);
      const expectedMargin = (100 * 10) / leverage;
      expect(Balance.get("user1")!.locked).toBe(expectedMargin);
      expect(Balance.get("user1")!.available).toBe(10000 - expectedMargin);
    });

    test(`new SHORT position leverage=${leverage} locks correct margin`, () => {
      seedBalance("user1", 10000);
      const result = UserBalanceLock(
        "user1",
        "SHORT",
        "BTC",
        10,
        100,
        leverage,
      );
      expect(result.success).toBe(true);
      const expectedMargin = (100 * 10) / leverage;
      expect(Balance.get("user1")!.locked).toBe(expectedMargin);
      expect(Balance.get("user1")!.available).toBe(10000 - expectedMargin);
    });
  }

  test("error when insufficient balance for LONG", () => {
    seedBalance("user1", 10);
    const result = UserBalanceLock("user1", "LONG", "BTC", 10, 100, 1);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Insufficient funds");
    expect(Balance.get("user1")!.available).toBe(10);
    expect(Balance.get("user1")!.locked).toBe(0);
  });

  test("error when insufficient balance for SHORT", () => {
    seedBalance("user1", 10);
    const result = UserBalanceLock("user1", "SHORT", "BTC", 10, 100, 2);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Insufficient funds");
  });

  test("exact available balance locks all funds", () => {
    seedBalance("user1", 100);
    const result = UserBalanceLock("user1", "LONG", "BTC", 10, 100, 10);
    expect(result.success).toBe(true);
    expect(Balance.get("user1")!.available).toBe(0);
    expect(Balance.get("user1")!.locked).toBe(100);
  });

  test("error when user balance not found", () => {
    const result = UserBalanceLock("nonexistent", "LONG", "BTC", 10, 100, 10);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Insufficient funds");
  });
});

describe("UserBalanceLock - same side existing position", () => {
  test("additional margin for same side LONG", () => {
    seedBalance("user1", 10000);
    seedPosition("user1", "BTC", "LONG", 5, 100, 10, 50);
    const result = UserBalanceLock("user1", "LONG", "BTC", 3, 200, 10);
    expect(result.success).toBe(true);
    const expectedExtra = (3 * 200) / 10;
    expect(Balance.get("user1")!.locked).toBe(expectedExtra);
    expect(Balance.get("user1")!.available).toBe(10000 - expectedExtra);
  });

  test("additional margin for same side SHORT", () => {
    seedBalance("user1", 10000);
    seedPosition("user1", "BTC", "SHORT", 5, 100, 10, 50);
    const result = UserBalanceLock("user1", "SHORT", "BTC", 3, 200, 10);
    expect(result.success).toBe(true);
    const expectedExtra = (3 * 200) / 10;
    expect(Balance.get("user1")!.locked).toBe(expectedExtra);
  });

  test("insufficient funds for same side increase", () => {
    seedBalance("user1", 10);
    seedPosition("user1", "BTC", "LONG", 5, 100, 10, 50);
    const result = UserBalanceLock("user1", "LONG", "BTC", 10, 100, 1);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Insufficient funds");
  });
});

describe("UserBalanceLock - opposite side existing position", () => {
  test("reduce position (opposite, smaller qty)", () => {
    seedBalance("user1", 10000);
    seedPosition("user1", "BTC", "LONG", 10, 100, 10, 100);
    const result = UserBalanceLock("user1", "SHORT", "BTC", 4, 150, 10);
    expect(result.success).toBe(true);
  });

  test("close position (opposite, equal qty)", () => {
    seedBalance("user1", 10000);
    seedPosition("user1", "BTC", "LONG", 10, 100, 10, 100);
    const result = UserBalanceLock("user1", "SHORT", "BTC", 10, 150, 10);
    expect(result.success).toBe(true);
  });

  test("flip position (opposite, larger qty) with sufficient funds", () => {
    seedBalance("user1", 10000);
    seedPosition("user1", "BTC", "LONG", 5, 100, 10, 50);
    const result = UserBalanceLock("user1", "SHORT", "BTC", 10, 200, 10);
    expect(result.success).toBe(true);
    const extraQty = 5;
    const expectedMargin = (extraQty * 200) / 10;
    expect(Balance.get("user1")!.locked).toBe(expectedMargin);
    expect(Balance.get("user1")!.available).toBe(10000 - expectedMargin);
  });

  test("flip position with insufficient funds", () => {
    seedBalance("user1", 10);
    seedPosition("user1", "BTC", "LONG", 5, 100, 10, 50);
    const result = UserBalanceLock("user1", "SHORT", "BTC", 10, 200, 1);
    expect(result.success).toBe(false);
    expect(result.error).toBe("insufficient funds");
  });
});

// =============================================
// CHECK POSITION UPDATES
// =============================================

describe("CheckPositionUpdates - new position", () => {
  test("creates new LONG position", () => {
    seedBalance("user1", 10000);
    const result = CheckPositionUpdates("user1", "BTC", "LONG", 100, 10, 10);
    expect(result.success).toBe(true);
    const pos = Position.get("user1")!.get("BTC")!;
    expect(pos.type).toBe("LONG");
    expect(pos.qty).toBe(10);
    expect(pos.averagePrice).toBe(100);
    expect(pos.margin).toBe(100);
    expect(pos.liquidationPrice).toBe(LiqudationPrice(10, 10, 100, "LONG"));
  });

  test("creates new SHORT position", () => {
    seedBalance("user1", 10000);
    CheckPositionUpdates("user1", "BTC", "SHORT", 200, 5, 20);
    const pos = Position.get("user1")!.get("BTC")!;
    expect(pos.type).toBe("SHORT");
    expect(pos.qty).toBe(5);
    expect(pos.averagePrice).toBe(200);
    expect(pos.margin).toBe(50);
  });

  test("error when balance not found", () => {
    const result = CheckPositionUpdates("user1", "BTC", "LONG", 100, 10, 10);
    expect(result.success).toBe(false);
    expect(result.error).toBe("balance not found");
  });

  const prices = [10, 50, 100, 500, 1000, 50000];
  const qties = [1, 5, 10, 50, 100];
  const levs = [1, 2, 5, 10, 20, 50, 100];
  for (const price of prices) {
    for (const qty of qties) {
      for (const lev of levs) {
        if (
          prices.indexOf(price) * qties.length * levs.length +
            qties.indexOf(qty) * levs.length +
            levs.indexOf(lev) >=
          50
        )
          break;
        test(`LONG price=${price} qty=${qty} lev=${lev}`, () => {
          seedBalance("user1", 1_000_000_000);
          const result = CheckPositionUpdates(
            "user1",
            "BTC",
            "LONG",
            price,
            qty,
            lev,
          );
          expect(result.success).toBe(true);
          const pos = Position.get("user1")!.get("BTC")!;
          expect(pos.qty).toBe(qty);
          expect(pos.averagePrice).toBe(price);
          expect(pos.margin).toBeCloseTo((price * qty) / lev, 5);
        });
      }
    }
  }
});

describe("CheckPositionUpdates - same side increase", () => {
  test("increases LONG position with average price update", () => {
    seedBalance("user1", 10000);
    CheckPositionUpdates("user1", "BTC", "LONG", 100, 10, 10);
    CheckPositionUpdates("user1", "BTC", "LONG", 200, 10, 10);
    const pos = Position.get("user1")!.get("BTC")!;
    expect(pos.qty).toBe(20);
    expect(pos.averagePrice).toBe(150);
    expect(pos.margin).toBe(100 + 200);
  });

  test("increases SHORT position", () => {
    seedBalance("user1", 10000);
    CheckPositionUpdates("user1", "BTC", "SHORT", 100, 5, 10);
    CheckPositionUpdates("user1", "BTC", "SHORT", 200, 5, 10);
    const pos = Position.get("user1")!.get("BTC")!;
    expect(pos.qty).toBe(10);
    expect(pos.averagePrice).toBe(150);
  });

  test("multiple sequential increases", () => {
    seedBalance("user1", 1_000_000);
    CheckPositionUpdates("user1", "BTC", "LONG", 100, 10, 10);
    CheckPositionUpdates("user1", "BTC", "LONG", 110, 10, 10);
    CheckPositionUpdates("user1", "BTC", "LONG", 120, 10, 10);
    const pos = Position.get("user1")!.get("BTC")!;
    expect(pos.qty).toBe(30);
    expect(pos.averagePrice).toBe(110);
  });
});

describe("CheckPositionUpdates - opposite side reduce", () => {
  test("reduces LONG position with SHORT fill", () => {
    seedBalance("user1", 10000);
    CheckPositionUpdates("user1", "BTC", "LONG", 100, 10, 10);
    Balance.set("user1", { available: 10000, locked: 100 });
    CheckPositionUpdates("user1", "BTC", "SHORT", 150, 4, 10);
    const pos = Position.get("user1")!.get("BTC")!;
    expect(pos.qty).toBe(6);
    expect(pos.type).toBe("LONG");
    expect(Balance.get("user1")!.locked).toBeCloseTo(100 - 40, 5);
    expect(Balance.get("user1")!.available).toBeCloseTo(
      10000 + 40 + (150 - 100) * 4,
      5,
    );
  });

  test("reduces SHORT position with LONG fill", () => {
    seedBalance("user1", 10000);
    CheckPositionUpdates("user1", "BTC", "SHORT", 200, 10, 10);
    Balance.set("user1", { available: 10000, locked: 200 });
    CheckPositionUpdates("user1", "BTC", "LONG", 150, 3, 10);
    const pos = Position.get("user1")!.get("BTC")!;
    expect(pos.qty).toBe(7);
    expect(pos.type).toBe("SHORT");
  });

  const reductions = [1, 2, 5, 8, 9];
  for (const reduceQty of reductions) {
    test(`reduce LONG position by ${reduceQty}`, () => {
      seedBalance("user1", 10000);
      CheckPositionUpdates("user1", "BTC", "LONG", 100, 10, 10);
      Balance.set("user1", { available: 10000, locked: 100 });
      CheckPositionUpdates("user1", "BTC", "SHORT", 120, reduceQty, 10);
      const pos = Position.get("user1")!.get("BTC")!;
      expect(pos.qty).toBe(10 - reduceQty);
    });
  }
});

describe("CheckPositionUpdates - opposite side close", () => {
  test("closes LONG position exactly", () => {
    seedBalance("user1", 10000);
    CheckPositionUpdates("user1", "BTC", "LONG", 100, 10, 10);
    Balance.set("user1", { available: 10000, locked: 100 });
    CheckPositionUpdates("user1", "BTC", "SHORT", 150, 10, 10);
    expect(Position.get("user1")!.has("BTC")).toBe(false);
    expect(Balance.get("user1")!.locked).toBe(0);
    const pnl = (150 - 100) * 10;
    expect(Balance.get("user1")!.available).toBe(10000 + 100 + pnl);
  });

  test("closes SHORT position exactly", () => {
    seedBalance("user1", 10000);
    CheckPositionUpdates("user1", "BTC", "SHORT", 200, 10, 10);
    Balance.set("user1", { available: 10000, locked: 200 });
    CheckPositionUpdates("user1", "BTC", "LONG", 150, 10, 10);
    expect(Position.get("user1")!.has("BTC")).toBe(false);
    const pnl = (200 - 150) * 10;
    expect(Balance.get("user1")!.available).toBe(10000 + 200 + pnl);
  });

  const closePrices = [50, 80, 100, 120, 150, 200, 500];
  for (const closePrice of closePrices) {
    test(`close LONG at ${closePrice} calculates PnL correctly`, () => {
      seedBalance("user1", 10000);
      CheckPositionUpdates("user1", "BTC", "LONG", 100, 10, 10);
      Balance.set("user1", { available: 10000, locked: 100 });
      CheckPositionUpdates("user1", "BTC", "SHORT", closePrice, 10, 10);
      const expectedPnl = (closePrice - 100) * 10;
      expect(Balance.get("user1")!.available).toBe(10000 + 100 + expectedPnl);
    });
  }
});

describe("CheckPositionUpdates - opposite side flip", () => {
  test("flips LONG to SHORT with extra qty", () => {
    seedBalance("user1", 10000);
    CheckPositionUpdates("user1", "BTC", "LONG", 100, 5, 10);
    Balance.set("user1", { available: 10000, locked: 50 });
    CheckPositionUpdates("user1", "BTC", "SHORT", 200, 10, 10);
    const pos = Position.get("user1")!.get("BTC")!;
    expect(pos.type).toBe("SHORT");
    expect(pos.qty).toBe(5);
    expect(pos.averagePrice).toBe(200);
  });

  test("flip with insufficient funds returns error", () => {
    // LONG position at 100, now flipping to SHORT at 60 (loss)
    seedBalance("user1", 10);
    CheckPositionUpdates("user1", "BTC", "LONG", 100, 5, 10);
    Balance.set("user1", { available: 10, locked: 50 });
    const result = CheckPositionUpdates("user1", "BTC", "SHORT", 60, 10, 10);
    expect(result.success).toBe(false);
    expect(result.error).toBe("insufficient funds");
  });

  test("flip multiple times alternates position type", () => {
    seedBalance("user1", 1_000_000);
    CheckPositionUpdates("user1", "BTC", "LONG", 100, 10, 10);
    Balance.set("user1", { available: 1_000_000, locked: 100 });
    CheckPositionUpdates("user1", "BTC", "SHORT", 200, 15, 10);
    let pos = Position.get("user1")!.get("BTC")!;
    expect(pos.type).toBe("SHORT");
    expect(pos.qty).toBe(5);
    Balance.set("user1", { available: 1_000_000, locked: pos.margin });
    CheckPositionUpdates("user1", "BTC", "LONG", 150, 8, 10);
    pos = Position.get("user1")!.get("BTC")!;
    expect(pos.type).toBe("LONG");
    expect(pos.qty).toBe(3);
  });
});

// =============================================
// CREATE ORDER - MARKET
// =============================================

describe("CreateOrder - Market LONG", () => {
  test("fills completely at one ask level", () => {
    seedBalance("user1", 10000);
    seedOrderbook("BTC", 50000, [], [[110, 20]]);
    const result = CreateOrder("user1", 10, 10, null, "LONG", "BTC", "Market");
    expectCreateOrderSuccess(result);
    expect(result.executedqty).toBe(10);
    expect(result.remaningqty).toBe(0);
    const pos = Position.get("user1")!.get("BTC")!;
    expect(pos.qty).toBe(10);
    expect(pos.type).toBe("LONG");
  });

  test("fills across multiple ask levels", () => {
    seedBalance("user1", 100000);
    seedOrderbook(
      "BTC",
      50000,
      [],
      [
        [100, 5],
        [101, 5],
        [102, 5],
        [103, 5],
      ],
    );
    const result = CreateOrder("user1", 15, 10, null, "LONG", "BTC", "Market");
    expectCreateOrderSuccess(result);
    expect(result.executedqty).toBe(15);
    const pos = Position.get("user1")!.get("BTC")!;
    expect(pos.qty).toBe(15);
    const expectedAvg = (5 * 100 + 5 * 101 + 5 * 102) / 15;
    expect(pos.averagePrice).toBeCloseTo(expectedAvg, 1);
  });

  test("fills 3 levels partially at last level", () => {
    seedBalance("user1", 100000);
    seedOrderbook(
      "BTC",
      50000,
      [],
      [
        [100, 10],
        [101, 10],
        [102, 10],
      ],
    );
    const result = CreateOrder("user1", 25, 10, null, "LONG", "BTC", "Market");
    expectCreateOrderSuccess(result);
    expect(result.executedqty).toBe(25);
    const expectedAvg = (10 * 100 + 10 * 101 + 5 * 102) / 25;
    const pos = Position.get("user1")!.get("BTC")!;
    expect(pos.averagePrice).toBeCloseTo(expectedAvg, 1);
  });

  test("returns partial fill when liquidity insufficient", () => {
    seedBalance("user1", 100000);
    seedOrderbook("BTC", 50000, [], [[100, 5]]);
    const result = CreateOrder("user1", 20, 10, null, "LONG", "BTC", "Market");
    expectCreateOrderSuccess(result);
    expect(result.executedqty).toBe(5);
  });

  test("no lastTradedPrice returns error", () => {
    seedBalance("user1", 10000);
    Orderbook.set("BTC", {
      bids: new Map(),
      asks: new Map(),
      lastTradedPrice: undefined as any,
      indexprice: 0,
    });
    const result = CreateOrder("user1", 10, 10, null, "LONG", "BTC", "Market");
    expectCreateOrderFailure(result);
    expect(result.error).toBe("lasttraded price not found");
  });

  test("no orderbook returns lasttraded price not found error", () => {
    seedBalance("user1", 10000);
    const result = CreateOrder("user1", 10, 10, null, "LONG", "BTC", "Market");
    expectCreateOrderFailure(result);
    expect(result.error).toBe("lasttraded price not found");
  });

  test("no balance returns error", () => {
    seedOrderbook("BTC", 50000, [], [[100, 20]]);
    const result = CreateOrder("user1", 10, 10, null, "LONG", "BTC", "Market");
    expectCreateOrderFailure(result);
    expect(result.error).toBe("Insufficient funds");
  });
});

describe("CreateOrder - Market SHORT", () => {
  test("fills completely at one bid level", () => {
    seedBalance("user1", 10000);
    seedOrderbook("BTC", 50000, [[100, 20]], []);
    const result = CreateOrder("user1", 10, 10, null, "SHORT", "BTC", "Market");
    expectCreateOrderSuccess(result);
    expect(result.executedqty).toBe(10);
    const pos = Position.get("user1")!.get("BTC")!;
    expect(pos.qty).toBe(10);
    expect(pos.type).toBe("SHORT");
  });

  test("fills across multiple bid levels (sorted descending)", () => {
    seedBalance("user1", 100000);
    seedOrderbook(
      "BTC",
      50000,
      [
        [105, 5],
        [104, 5],
        [103, 5],
        [102, 5],
      ],
      [],
    );
    const result = CreateOrder("user1", 15, 10, null, "SHORT", "BTC", "Market");
    expectCreateOrderSuccess(result);
    expect(result.executedqty).toBe(15);
    const pos = Position.get("user1")!.get("BTC")!;
    expect(pos.qty).toBe(15);
    const expectedAvg = (5 * 105 + 5 * 104 + 5 * 103) / 15;
    expect(pos.averagePrice).toBeCloseTo(expectedAvg, 1);
  });

  test("partial fill when liquidity insufficient for SHORT", () => {
    seedBalance("user1", 100000);
    seedOrderbook("BTC", 50000, [[100, 3]], []);
    const result = CreateOrder("user1", 10, 10, null, "SHORT", "BTC", "Market");
    expectCreateOrderSuccess(result);
    expect(result.executedqty).toBe(3);
  });
});

// =============================================
// CREATE ORDER - LIMIT
// =============================================

describe("CreateOrder - Limit LONG", () => {
  test("fills immediately when limit price >= ask", () => {
    seedBalance("user1", 10000);
    seedOrderbook("BTC", 50000, [], [[100, 10]]);
    const result = CreateOrder("user1", 10, 10, 101, "LONG", "BTC", "Limit");
    expectCreateOrderSuccess(result);
    expect(result.executedqty).toBe(10);
    expect(result.remaningqty).toBe(0);
  });

  test("partial fill then rest to orderbook", () => {
    seedBalance("user1", 10000);
    seedOrderbook(
      "BTC",
      50000,
      [],
      [
        [100, 5],
        [101, 5],
      ],
    );
    const result = CreateOrder("user1", 12, 10, 101, "LONG", "BTC", "Limit");
    expectCreateOrderSuccess(result);
    expect(result.executedqty).toBe(10);
    expect(result.remaningqty).toBe(2);
    const book = Orderbook.get("BTC")!;
    const bidLevel = book.bids.get(101);
    expect(bidLevel).toBeDefined();
    expect(bidLevel!.availableQty).toBe(2);
  });

  test("no fill when limit price below lowest ask", () => {
    seedBalance("user1", 10000);
    seedOrderbook("BTC", 50000, [], [[105, 10]]);
    const result = CreateOrder("user1", 10, 10, 100, "LONG", "BTC", "Limit");
    expectCreateOrderSuccess(result);
    expect(result.executedqty).toBe(0);
    expect(result.remaningqty).toBe(10);
    const book = Orderbook.get("BTC")!;
    expect(book.bids.get(100)!.availableQty).toBe(10);
  });

  test("fills across multiple levels then rest to book", () => {
    seedBalance("user1", 100000);
    seedOrderbook(
      "BTC",
      50000,
      [],
      [
        [100, 5],
        [101, 5],
        [102, 5],
      ],
    );
    const result = CreateOrder("user1", 20, 10, 102, "LONG", "BTC", "Limit");
    expectCreateOrderSuccess(result);
    expect(result.executedqty).toBe(15);
    expect(result.remaningqty).toBe(5);
    expect(Orderbook.get("BTC")!.bids.get(102)!.availableQty).toBe(5);
  });

  test("requires price for limit order", () => {
    seedBalance("user1", 10000);
    seedOrderbook("BTC", 50000, [], [[100, 10]]);
    const result = CreateOrder("user1", 10, 10, null, "LONG", "BTC", "Limit");
    expectCreateOrderFailure(result);
    expect(result.error).toBe("Price needed for the limit order");
  });
});

describe("CreateOrder - Limit SHORT", () => {
  test("fills immediately when limit price <= bid", () => {
    seedBalance("user1", 10000);
    seedOrderbook("BTC", 50000, [[105, 10]], []);
    const result = CreateOrder("user1", 10, 10, 104, "SHORT", "BTC", "Limit");
    expectCreateOrderSuccess(result);
    expect(result.executedqty).toBe(10);
  });

  test("no fill when limit price above highest bid", () => {
    seedBalance("user1", 10000);
    seedOrderbook("BTC", 50000, [[100, 10]], []);
    const result = CreateOrder("user1", 10, 10, 105, "SHORT", "BTC", "Limit");
    expectCreateOrderSuccess(result);
    expect(result.executedqty).toBe(0);
    expect(Orderbook.get("BTC")!.asks.get(105)!.availableQty).toBe(10);
  });

  test("partial fill then rest to asks book", () => {
    seedBalance("user1", 10000);
    seedOrderbook(
      "BTC",
      50000,
      [
        [105, 5],
        [104, 5],
      ],
      [],
    );
    const result = CreateOrder("user1", 8, 10, 104, "SHORT", "BTC", "Limit");
    expectCreateOrderSuccess(result);
    expect(result.executedqty).toBe(8);
    expect(Orderbook.get("BTC")!.asks.get(104)).toBeUndefined();
  });
});

// =============================================
// CREATE ORDER - MAKER POSITION UPDATES
// =============================================

describe("CreateOrder - updates maker positions", () => {
  function seedMakerOrderbook(market: string, lastPrice: number) {
    const makerOrder1: openOrders = {
      userId: "maker1",
      qty: 10,
      filledQty: 0,
      orderId: "maker-order-1",
      createdAt: new Date(),
      leverage: 10,
    };
    const makerOrder2: openOrders = {
      userId: "maker2",
      qty: 5,
      filledQty: 0,
      orderId: "maker-order-2",
      createdAt: new Date(),
      leverage: 10,
    };
    const asks = new Map<
      number,
      { availableQty: number; openOrders: openOrders[] }
    >();
    asks.set(100, { availableQty: 10, openOrders: [makerOrder1] });
    asks.set(101, { availableQty: 5, openOrders: [makerOrder2] });
    Orderbook.set(market, {
      bids: new Map(),
      asks,
      lastTradedPrice: lastPrice,
      indexprice: lastPrice,
    });
  }

  test("maker position is updated on fill", () => {
    seedBalance("user1", 100000);
    seedBalance("maker1", 100000);
    seedBalance("maker2", 100000);
    seedMakerOrderbook("BTC", 50000);

    CreateOrder("user1", 12, 10, null, "LONG", "BTC", "Market");

    const maker1Pos = Position.get("maker1")!.get("BTC")!;
    expect(maker1Pos).toBeDefined();
    expect(maker1Pos.type).toBe("SHORT");
    expect(maker1Pos.qty).toBe(10);

    const maker2Pos = Position.get("maker2")!.get("BTC")!;
    expect(maker2Pos).toBeDefined();
    expect(maker2Pos.type).toBe("SHORT");
    expect(maker2Pos.qty).toBe(2);
  });

  test("maker orders are removed when fully filled", () => {
    seedBalance("user1", 100000);
    seedBalance("maker1", 100000);
    seedMakerOrderbook("BTC", 50000);

    CreateOrder("user1", 10, 10, null, "LONG", "BTC", "Market");

    const book = Orderbook.get("BTC")!;
    expect(book.asks.has(100)).toBe(false);
  });
});

// =============================================
// PnL
// =============================================

describe("Pnl", () => {
  test("LONG profit when current price > average", () => {
    const pos = {
      market: "BTC",
      liquidationPrice: 90,
      type: "LONG" as const,
      qty: 10,
      margin: 100,
      averagePrice: 100,
      leverage: 10,
    };
    expect(Pnl(pos, 150)).toBe(500);
  });

  test("LONG loss when current price < average", () => {
    const pos = {
      market: "BTC",
      liquidationPrice: 90,
      type: "LONG" as const,
      qty: 10,
      margin: 100,
      averagePrice: 100,
      leverage: 10,
    };
    expect(Pnl(pos, 80)).toBe(-200);
  });

  test("SHORT profit when current price < average", () => {
    const pos = {
      market: "BTC",
      liquidationPrice: 110,
      type: "SHORT" as const,
      qty: 10,
      margin: 100,
      averagePrice: 100,
      leverage: 10,
    };
    expect(Pnl(pos, 80)).toBe(200);
  });

  test("SHORT loss when current price > average", () => {
    const pos = {
      market: "BTC",
      liquidationPrice: 110,
      type: "SHORT" as const,
      qty: 10,
      margin: 100,
      averagePrice: 100,
      leverage: 10,
    };
    expect(Pnl(pos, 150)).toBe(-500);
  });

  test("zero PnL when price equals average", () => {
    const posL = {
      market: "BTC",
      liquidationPrice: 90,
      type: "LONG" as const,
      qty: 10,
      margin: 100,
      averagePrice: 100,
      leverage: 10,
    };
    expect(Pnl(posL, 100)).toBe(0);
    const posS = {
      market: "BTC",
      liquidationPrice: 110,
      type: "SHORT" as const,
      qty: 10,
      margin: 100,
      averagePrice: 100,
      leverage: 10,
    };
    expect(Pnl(posS, 100)).toBe(0);
  });

  const prices = [10, 50, 100, 200, 500, 1000];
  for (const avg of prices) {
    for (const current of prices) {
      test(`LONG avg=${avg} current=${current}`, () => {
        const pos = {
          market: "BTC",
          liquidationPrice: 0,
          type: "LONG" as const,
          qty: 1,
          margin: 0,
          averagePrice: avg,
          leverage: 10,
        };
        expect(Pnl(pos, current)).toBe((current - avg) * 1);
      });
      test(`SHORT avg=${avg} current=${current}`, () => {
        const pos = {
          market: "BTC",
          liquidationPrice: 0,
          type: "SHORT" as const,
          qty: 1,
          margin: 0,
          averagePrice: avg,
          leverage: 10,
        };
        expect(Pnl(pos, current)).toBe((avg - current) * 1);
      });
    }
  }
});

// =============================================
// LIQUIDATE POSITION
// =============================================

describe("LiquidatePosition", () => {
  test("LONG position liquidated when price <= liquidationPrice", () => {
    seedBalance("user1", 100000);
    seedBalance("maker1", 100000);
    seedPosition("user1", "BTC", "LONG", 10, 110, 10, 100);
    seedOrderbook("BTC", 50000, [[150, 20]], []);
    const pos = Position.get("user1")!.get("BTC")!;
    LiquidatePosition(90, "BTC", pos, "user1");
    const userPos = Position.get("user1")?.get("BTC");
    expect(userPos?.type).toBeUndefined();
  });

  test("SHORT position liquidated when price >= liquidationPrice", () => {
    seedBalance("user1", 100000);
    seedBalance("maker1", 100000);
    seedPosition("user1", "BTC", "SHORT", 10, 140, 10, 100);
    seedOrderbook("BTC", 50000, [], [[200, 20]]);
    const pos = Position.get("user1")!.get("BTC")!;
    LiquidatePosition(160, "BTC", pos, "user1");
    const userPos = Position.get("user1")?.get("BTC");
    expect(userPos?.type).toBeUndefined();
  });

  test("does NOT liquidate LONG when price above liquidationPrice", () => {
    seedBalance("user1", 100000);
    seedBalance("maker1", 100000);
    seedPosition("user1", "BTC", "LONG", 10, 110, 10, 100);
    seedOrderbook("BTC", 50000, [[150, 20]], []);
    const pos = Position.get("user1")!.get("BTC")!;
    LiquidatePosition(101, "BTC", pos, "user1");
    const userPos = Position.get("user1")!.get("BTC")!;
    expect(userPos.qty).toBe(10);
  });

  test("does NOT liquidate SHORT when price below liquidationPrice", () => {
    seedBalance("user1", 100000);
    seedBalance("maker1", 100000);
    seedPosition("user1", "BTC", "SHORT", 10, 140, 10, 100);
    seedOrderbook("BTC", 50000, [[150, 20]], []);
    const pos = Position.get("user1")!.get("BTC")!;
    LiquidatePosition(149, "BTC", pos, "user1");
    const userPos = Position.get("user1")!.get("BTC")!;
    expect(userPos.qty).toBe(10);
  });

  test("partial liquidation preserves correct liquidation price for LONG", () => {
    seedBalance("user1", 100000);
    seedBalance("maker1", 100000);
    seedPosition("user1", "BTC", "LONG", 10, 100, 10);
    seedOrderbook("BTC", 50000, [[150, 4]], []);
    const pos = Position.get("user1")!.get("BTC")!;
    expect(pos.liquidationPrice).toBe(90);
    LiquidatePosition(80, "BTC", pos, "user1");
    const remaining = Position.get("user1")!.get("BTC")!;
    expect(remaining.qty).toBe(6);
    expect(remaining.liquidationPrice).toBe(90);
  });

  test("partial liquidation preserves correct liquidation price for SHORT", () => {
    seedBalance("user1", 100000);
    seedBalance("maker1", 100000);
    seedPosition("user1", "BTC", "SHORT", 10, 100, 10);
    seedOrderbook("BTC", 50000, [], [[50, 4]]);
    const pos = Position.get("user1")!.get("BTC")!;
    expect(pos.liquidationPrice).toBe(110);
    LiquidatePosition(120, "BTC", pos, "user1");
    const remaining = Position.get("user1")!.get("BTC")!;
    expect(remaining.qty).toBe(6);
    expect(remaining.liquidationPrice).toBe(110);
  });
});

// =============================================
// CHECK FOR LIQUIDATION
// =============================================

describe("CheckForLiqudation", () => {
  test("liquidates all users with LONG positions when price drops", () => {
    seedBalance("user1", 100000);
    seedBalance("user2", 100000);
    seedBalance("maker1", 100000);
    seedOrderbook("BTC", 50000, [[150, 100]], []);
    seedPosition("user1", "BTC", "LONG", 10, 100, 10);
    seedPosition("user2", "BTC", "LONG", 5, 100, 10);
    CheckForLiqudation("BTC", 80);
    expect(Position.get("user1")?.has("BTC")).toBe(false);
    expect(Position.get("user2")?.has("BTC")).toBe(false);
  });

  test("liquidates only affected users", () => {
    seedBalance("user1", 100000);
    seedBalance("user2", 100000);
    seedBalance("maker1", 100000);
    seedOrderbook("BTC", 50000, [[150, 100]], []);
    seedPosition("user1", "BTC", "LONG", 10, 100, 10);
    seedPosition("user2", "ETH", "LONG", 5, 100, 10);
    CheckForLiqudation("BTC", 80);
    expect(Position.get("user1")?.has("BTC")).toBe(false);
    expect(Position.get("user2")?.has("ETH")).toBe(true);
  });

  test("skips users with no position in the market", () => {
    seedBalance("user1", 100000);
    seedBalance("maker1", 100000);
    seedOrderbook("BTC", 50000, [[150, 100]], []);
    CheckForLiqudation("BTC", 80);
    expect(Position.size).toBe(0);
  });

  test("does not liquidate positions not at risk", () => {
    seedBalance("user1", 100000);
    seedBalance("maker1", 100000);
    seedOrderbook("BTC", 50000, [[150, 100]], []);
    seedPosition("user1", "BTC", "LONG", 10, 100, 10);
    CheckForLiqudation("BTC", 95);
    expect(Position.get("user1")?.has("BTC")).toBe(true);
  });
});

// =============================================
// INTEGRATION: COMPLETE FLOW
// =============================================

describe("Integration - complete trading flow", () => {
  test("initialize → onramp → market buy → limit sell → close", () => {
    // Setup
    seedBalance("maker1", 100000);
    seedBalance("user1", 0);
    seedOrderbook(
      "BTC",
      50000,
      [
        [200, 10],
        [199, 10],
        [198, 10],
      ],
      [
        [201, 10],
        [202, 10],
        [203, 10],
      ],
    );

    // Initialize balance
    initalizedBalnce("user1");
    expect(Balance.get("user1")!.available).toBe(0);

    // Onramp
    OnRamp("user1", 10000);
    expect(Balance.get("user1")!.available).toBe(10000);

    // Market buy
    const buyResult = CreateOrder(
      "user1",
      5,
      10,
      null,
      "LONG",
      "BTC",
      "Market",
    );
    expectCreateOrderSuccess(buyResult);
    expect(buyResult.executedqty).toBe(5);
    let pos = Position.get("user1")!.get("BTC")!;
    expect(pos.type).toBe("LONG");
    expect(pos.qty).toBe(5);

    // Check locked balance
    const lockedAfterBuy = Balance.get("user1")!.locked;
    expect(lockedAfterBuy).toBeGreaterThan(0);

    // Limit sell partial close
    const sellResult = CreateOrder(
      "user1",
      3,
      10,
      199,
      "SHORT",
      "BTC",
      "Limit",
    );
    expectCreateOrderSuccess(sellResult);
    pos = Position.get("user1")!.get("BTC")!;
    expect(pos.qty).toBe(2);
    expect(pos.type).toBe("LONG");

    // Close remaining
    Balance.set("user1", { available: 10000, locked: pos.margin });
    CreateOrder("user1", 2, 10, 198, "SHORT", "BTC", "Market");
    expect(Position.get("user1")?.has("BTC")).toBeFalsy();
    expect(Balance.get("user1")!.locked).toBe(0);
  });

  test("two users on opposite sides both get filled", () => {
    seedBalance("alice", 100000);
    seedBalance("bob", 100000);
    const bobOrder: openOrders = {
      userId: "bob",
      qty: 10,
      filledQty: 0,
      orderId: "bob-sell",
      createdAt: new Date(),
      leverage: 10,
    };
    const asks = new Map<
      number,
      { availableQty: number; openOrders: openOrders[] }
    >();
    asks.set(100, { availableQty: 10, openOrders: [bobOrder] });
    Orderbook.set("BTC", {
      bids: new Map(),
      asks,
      lastTradedPrice: 100,
      indexprice: 100,
    });

    const result = CreateOrder("alice", 10, 10, null, "LONG", "BTC", "Market");
    expectCreateOrderSuccess(result);

    const alicePos = Position.get("alice")!.get("BTC")!;
    expect(alicePos.type).toBe("LONG");
    expect(alicePos.qty).toBe(10);

    const bobPos = Position.get("bob")!.get("BTC")!;
    expect(bobPos.type).toBe("SHORT");
    expect(bobPos.qty).toBe(10);
  });
});

// =============================================
// EDGE CASES
// =============================================

describe("Edge cases", () => {
  test("zero qty order", () => {
    seedBalance("user1", 10000);
    seedOrderbook("BTC", 50000, [[100, 5]], []);
    const result = CreateOrder("user1", 0, 10, null, "LONG", "BTC", "Market");
    expectCreateOrderFailure(result);
    expect(result.error).toBe("invalid quantity");
  });

  test("zero leverage is rejected instead of returning infinity", () => {
    expect(() => LiqudationPrice(0, 10, 100, "LONG")).toThrow(
      "invalid leverage",
    );
    const result = CreateOrder("user1", 1, 0, null, "LONG", "BTC", "Market");
    expectCreateOrderFailure(result);
    expect(result.error).toBe("invalid leverage");
  });

  test("very small qty fills", () => {
    seedBalance("user1", 10000);
    seedOrderbook("BTC", 50000, [], [[100, 1]]);
    const result = CreateOrder(
      "user1",
      0.001,
      10,
      null,
      "LONG",
      "BTC",
      "Market",
    );
    expectCreateOrderSuccess(result);
    expect(result.executedqty).toBe(0.001);
  });

  test("multiple markets are independent", () => {
    seedBalance("user1", 1_000_000);
    seedOrderbook("BTC", 50000, [], [[100, 10]]);
    seedOrderbook("ETH", 3000, [], [[10, 100]]);

    CreateOrder("user1", 5, 10, null, "LONG", "BTC", "Market");
    CreateOrder("user1", 50, 5, null, "LONG", "ETH", "Market");

    const btcPos = Position.get("user1")!.get("BTC")!;
    const ethPos = Position.get("user1")!.get("ETH")!;
    expect(btcPos.qty).toBe(5);
    expect(btcPos.type).toBe("LONG");
    expect(ethPos.qty).toBe(50);
    expect(ethPos.type).toBe("LONG");
  });

  test("repeated same-side limit orders accumulate in orderbook", () => {
    seedBalance("user1", 1_000_000);
    seedOrderbook("BTC", 50000, [], [[200, 0]]);

    CreateOrder("user1", 5, 10, 150, "LONG", "BTC", "Limit");
    CreateOrder("user1", 3, 10, 150, "LONG", "BTC", "Limit");

    const book = Orderbook.get("BTC")!.bids.get(150)!;
    expect(book.availableQty).toBe(8);
    expect(book.openOrders.length).toBe(2);
  });

  test("zero amount onramp", async () => {
    await initalizedBalnce("user1");
    const result = await OnRamp("user1", 0);
    expect(result.success).toBe(true);
    expect(Balance.get("user1")!.available).toBe(0);
  });

  test("repeated liquidation check is safe when no positions", () => {
    seedOrderbook("BTC", 50000, [[100, 10]], [[200, 10]]);
    CheckForLiqudation("BTC", 50);
    CheckForLiqudation("BTC", 100);
    CheckForLiqudation("BTC", 150);
    expect(Position.size).toBe(0);
  });
});

// =============================================
// BULK: UserBalanceLock exhaustive combos
// =============================================

describe("Bulk UserBalanceLock - price/qty/leverage combos", () => {
  const balances = [100, 500, 1000, 5000, 10000, 50000, 100000, 1000000];
  const prices = [10, 50, 100, 200, 500, 1000, 10000, 50000];
  const qties = [1, 2, 5, 10, 20, 50, 100];
  const leverages = [1, 2, 5, 10, 20, 50, 100];
  const types = ["LONG", "SHORT"] as const;
  let count = 0;

  for (const balance of balances) {
    for (const price of prices) {
      for (const qty of qties) {
        for (const lev of leverages) {
          for (const type of types) {
            if (count >= 120) break;
            const margin = (price * qty) / lev;
            const shouldSucceed = balance >= margin;
            test(`bal=${balance} price=${price} qty=${qty} lev=${lev} ${type} => ${shouldSucceed ? "ok" : "fail"}`, () => {
              seedBalance("user1", balance);
              const result = UserBalanceLock(
                "user1",
                type,
                "BTC",
                qty,
                price,
                lev,
              );
              if (shouldSucceed) {
                expect(result.success).toBe(true);
                expect(Balance.get("user1")!.locked).toBe(margin);
                expect(Balance.get("user1")!.available).toBe(balance - margin);
              } else {
                expect(result.success).toBe(false);
                expect(Balance.get("user1")!.locked).toBe(0);
                expect(Balance.get("user1")!.available).toBe(balance);
              }
            });
            count++;
          }
          if (count >= 120) break;
        }
        if (count >= 120) break;
      }
      if (count >= 120) break;
    }
    if (count >= 120) break;
  }
});

// =============================================
// BULK: UserBalanceLock position flip edge cases
// =============================================

describe("Bulk UserBalanceLock - with existing opposite position", () => {
  const existingQties = [5, 10, 20];
  const closeQties = [3, 5, 7, 10, 15, 20, 25];
  for (const existingQty of existingQties) {
    for (const closeQty of closeQties) {
      test(`existing=${existingQty} ${existingQty > closeQty ? "reduce" : existingQty === closeQty ? "close" : "flip"} qty=${closeQty}`, () => {
        seedBalance("user1", 100000);
        seedPosition(
          "user1",
          "BTC",
          "LONG",
          existingQty,
          100,
          10,
          (100 * existingQty) / 10,
        );
        Balance.set("user1", {
          available: 100000 - (100 * existingQty) / 10,
          locked: (100 * existingQty) / 10,
        });

        const result = UserBalanceLock(
          "user1",
          "SHORT",
          "BTC",
          closeQty,
          200,
          10,
        );
        expect(result.success).toBe(true);

        // UserBalanceLock only locks EXTRA margin for opposite-side flips
        // It does NOT release existing locked margin (that's CheckPositionUpdates' job)
        const existingMargin = (100 * existingQty) / 10;
        if (closeQty > existingQty) {
          const extraQty = closeQty - existingQty;
          const extraMargin = (extraQty * 200) / 10;
          expect(Balance.get("user1")!.locked).toBe(
            existingMargin + extraMargin,
          );
        } else {
          // close or reduce: no new margin locked, existing stays
          expect(Balance.get("user1")!.locked).toBe(existingMargin);
        }
      });
    }
  }
});

// =============================================
// BULK: CalculateAveragePrice high volume
// =============================================

describe("Bulk CalculateAveragePrice", () => {
  const testCases: {
    qty: number;
    price: number;
    oldAvg: number;
    oldQty: number;
  }[] = [];
  const prices = [
    1, 5, 10, 25, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 2500, 5000, 10000,
  ];
  const qties = [0.1, 0.5, 1, 2, 3, 5, 10, 15, 20, 30, 50, 75, 100];
  for (const price of prices) {
    for (const qty of qties) {
      for (const oldAvg of prices) {
        for (const oldQty of qties) {
          if (testCases.length >= 200) break;
          testCases.push({ qty, price, oldAvg, oldQty });
        }
        if (testCases.length >= 200) break;
      }
      if (testCases.length >= 200) break;
    }
    if (testCases.length >= 200) break;
  }

  test.each(testCases)(
    "qty=$qty price=$price oldAvg=$oldAvg oldQty=$oldQty",
    ({ qty, price, oldAvg, oldQty }) => {
      const expected = (qty * price + oldAvg * oldQty) / (qty + oldQty);
      expect(CalculateAveragePrice(qty, price, oldAvg, oldQty)).toBeCloseTo(
        expected,
        10,
      );
    },
  );
});

// =============================================
// BULK: CheckPositionUpdates exhaustive
// =============================================

describe("Bulk CheckPositionUpdates - new positions", () => {
  const markets = ["BTC", "ETH", "SOL", "DOGE", "ADA"];
  const prices = [10, 50, 100, 500, 1000, 10000];
  const qties = [0.1, 1, 5, 10, 50, 100];
  const levs = [1, 2, 5, 10, 20, 50];
  const types = ["LONG", "SHORT"] as const;
  let idx = 0;

  for (const market of markets) {
    for (const price of prices) {
      for (const qty of qties) {
        for (const lev of levs) {
          for (const type of types) {
            if (idx >= 150) break;
            test(`market=${market} price=${price} qty=${qty} lev=${lev} ${type}`, () => {
              seedBalance("user1", 1_000_000_000);
              const result = CheckPositionUpdates(
                "user1",
                market,
                type,
                price,
                qty,
                lev,
              );
              expect(result.success).toBe(true);
              const pos = Position.get("user1")!.get(market)!;
              expect(pos.market).toBe(market);
              expect(pos.type).toBe(type);
              expect(pos.qty).toBe(qty);
              expect(pos.averagePrice).toBe(price);
              expect(pos.margin).toBeCloseTo((price * qty) / lev, 5);
            });
            idx++;
          }
          if (idx >= 150) break;
        }
        if (idx >= 150) break;
      }
      if (idx >= 150) break;
    }
    if (idx >= 150) break;
  }
});

describe("Bulk CheckPositionUpdates - same side increases", () => {
  const scenarios: {
    initial: { qty: number; price: number };
    add: { qty: number; price: number };
    lev: number;
  }[] = [];
  const qties = [1, 3, 5, 10];
  const prices = [100, 110, 120, 200, 500];
  for (const iQty of qties) {
    for (const iPrice of prices) {
      for (const aQty of qties) {
        for (const aPrice of prices) {
          if (scenarios.length >= 100) break;
          scenarios.push({
            initial: { qty: iQty, price: iPrice },
            add: { qty: aQty, price: aPrice },
            lev: 10,
          });
        }
        if (scenarios.length >= 100) break;
      }
      if (scenarios.length >= 100) break;
    }
    if (scenarios.length >= 100) break;
  }

  test.each(scenarios)(
    "init qty=$initial.qty@$initial.price + add qty=$add.qty@$add.price",
    ({ initial, add, lev }) => {
      seedBalance("user1", 1_000_000);
      CheckPositionUpdates(
        "user1",
        "BTC",
        "LONG",
        initial.price,
        initial.qty,
        lev,
      );
      Balance.set("user1", {
        available: 1_000_000,
        locked: (initial.price * initial.qty) / lev,
      });
      CheckPositionUpdates("user1", "BTC", "LONG", add.price, add.qty, lev);
      const pos = Position.get("user1")!.get("BTC")!;
      expect(pos.qty).toBe(initial.qty + add.qty);
      const expectedAvg = CalculateAveragePrice(
        add.qty,
        add.price,
        initial.price,
        initial.qty,
      );
      expect(pos.averagePrice).toBeCloseTo(expectedAvg, 5);
    },
  );
});

// =============================================
// BULK: CheckPositionUpdates opposite side close
// =============================================

describe("Bulk CheckPositionUpdates - close positions at various prices", () => {
  const entryPrices = [100, 200, 500];
  const exitPrices = [50, 80, 100, 120, 150, 200, 300, 500, 800];
  const qties = [1, 5, 10, 20];
  let idx = 0;

  for (const entry of entryPrices) {
    for (const exit of exitPrices) {
      for (const qty of qties) {
        if (idx >= 60) break;
        const pnl = (exit - entry) * qty;
        test(`entry=${entry} exit=${exit} qty=${qty} pnl=${pnl >= 0 ? "profit" : "loss"}`, () => {
          seedBalance("user1", 100000);
          CheckPositionUpdates("user1", "BTC", "LONG", entry, qty, 10);
          const lockedMargin = (entry * qty) / 10;
          Balance.set("user1", { available: 100000, locked: lockedMargin });
          CheckPositionUpdates("user1", "BTC", "SHORT", exit, qty, 10);
          expect(Position.get("user1")?.has("BTC")).toBe(false);
          expect(Balance.get("user1")!.locked).toBe(0);
          expect(Balance.get("user1")!.available).toBe(
            100000 + lockedMargin + pnl,
          );
        });
        idx++;
      }
      if (idx >= 60) break;
    }
    if (idx >= 60) break;
  }
});

// =============================================
// BULK: CreateOrder market fills
// =============================================

describe("Bulk CreateOrder - Market fills at varying depths", () => {
  const depths = [1, 2, 3, 5, 10];
  const fillQs = [1, 2, 5, 10, 20];
  let idx = 0;

  for (const depth of depths) {
    for (const qty of fillQs) {
      if (qty > depth * 10) continue;
      if (idx >= 60) break;

      const asks: [number, number][] = [];
      for (let i = 0; i < depth; i++) {
        asks.push([100 + i, 10]);
      }

      test(`depth=${depth} levels qty=${qty} -> should fill`, () => {
        seedBalance("user1", 1000000);
        seedBalance("maker1", 1000000);
        seedOrderbook("BTC", 50000, [], asks);
        const result = CreateOrder(
          "user1",
          qty,
          10,
          null,
          "LONG",
          "BTC",
          "Market",
        );
        expectCreateOrderSuccess(result);
        expect(result.executedqty).toBe(qty);
        expect(result.remaningqty).toBe(0);
      });
      idx++;
    }
    if (idx >= 60) break;
  }
});

describe("Bulk CreateOrder - Market partial fill (available < requested)", () => {
  const scenarios: { totalAvailable: number; requested: number }[] = [];
  for (let avail = 1; avail <= 10; avail++) {
    for (let req = avail + 1; req <= avail + 5 && req <= 30; req++) {
      scenarios.push({ totalAvailable: avail, requested: req });
    }
  }

  const selected = scenarios.filter((_, i) => i % 2 === 0).slice(0, 30);
  test.each(selected)(
    "available=$totalAvailable requested=$requested => partial fill $totalAvailable",
    ({ totalAvailable, requested }) => {
      seedBalance("user1", 1000000);
      seedBalance("maker1", 1000000);
      const asks: [number, number][] = [[100, totalAvailable]];
      seedOrderbook("BTC", 50000, [], asks);
      const result = CreateOrder(
        "user1",
        requested,
        10,
        null,
        "LONG",
        "BTC",
        "Market",
      );
      expectCreateOrderSuccess(result);
      expect(result.executedqty).toBe(totalAvailable);
    },
  );
});

test("Insufficient order when no liquidity at all for market order", () => {
  seedBalance("user1", 1000000);
  const asksMap = new Map();
  Orderbook.set("BTC", {
    bids: new Map(),
    asks: asksMap,
    lastTradedPrice: 50000,
    indexprice: 50000,
  });
  const result = CreateOrder("user1", 10, 10, null, "LONG", "BTC", "Market");
  expectCreateOrderFailure(result);
  // Note: engine code has typo "errror" instead of "error" at matchorder.ts:128
});

// =============================================
// BULK: CreateOrder Limit partial fills
// =============================================

describe("Bulk CreateOrder - Limit orders with partial fill", () => {
  const fillPcts = [0, 20, 50, 80, 100];
  let idx = 0;

  for (const fillPct of fillPcts) {
    if (idx >= 25) break;
    test(`limit LONG fills ${fillPct}% of order`, () => {
      const totalQty = 10;
      const fillQty = (totalQty * fillPct) / 100;
      const remaining = totalQty - fillQty;
      const askQty = fillQty > 0 ? fillQty : 0;

      seedBalance("user1", 100000);
      seedBalance("maker1", 100000);
      const asks: [number, number][] = askQty > 0 ? [[100, askQty]] : [];
      seedOrderbook("BTC", 50000, [], asks);
      const result = CreateOrder(
        "user1",
        totalQty,
        10,
        100,
        "LONG",
        "BTC",
        "Limit",
      );
      expectCreateOrderSuccess(result);
      expect(result.executedqty).toBe(fillQty);
      expect(result.remaningqty).toBe(remaining);

      if (remaining > 0) {
        const book = Orderbook.get("BTC")!.bids.get(100)!;
        expect(book.availableQty).toBe(remaining);
      }
    });
    idx++;
  }

  for (const fillPct of fillPcts) {
    if (idx >= 50) break;
    test(`limit SHORT fills ${fillPct}% of order`, () => {
      const totalQty = 10;
      const fillQty = (totalQty * fillPct) / 100;
      const remaining = totalQty - fillQty;
      const bidQty = fillQty > 0 ? fillQty : 0;

      seedBalance("user1", 100000);
      seedBalance("maker1", 100000);
      const bids: [number, number][] = bidQty > 0 ? [[100, bidQty]] : [];
      seedOrderbook("BTC", 50000, bids, []);
      const result = CreateOrder(
        "user1",
        totalQty,
        10,
        100,
        "SHORT",
        "BTC",
        "Limit",
      );
      expectCreateOrderSuccess(result);
      expect(result.executedqty).toBe(fillQty);
      expect(result.remaningqty).toBe(remaining);

      if (remaining > 0) {
        const book = Orderbook.get("BTC")!.asks.get(100)!;
        expect(book.availableQty).toBe(remaining);
      }
    });
    idx++;
  }
});

// =============================================
// BULK: OnRamp with amounts
// =============================================

describe("Bulk OnRamp - various amounts", () => {
  const amounts = [
    0, 0.01, 0.1, 0.5, 1, 5, 10, 25, 50, 75, 99.99, 100, 150, 200, 250, 500,
    750, 1000, 2500, 5000, 10000, 25000, 50000, 99999.99, 100000, 250000,
    500000, 1000000, 10000000, 100000000,
  ];
  for (const amount of amounts) {
    test(`onramp ${amount}`, async () => {
      await initalizedBalnce("user1");
      const result = await OnRamp("user1", amount);
      expect(result.success).toBe(true);
      expect(result.amount).toBe(amount);
      expect(Balance.get("user1")!.available).toBe(amount);
    });
  }
});

// =============================================
// BULK: PnL calculations
// =============================================

describe("Bulk PnL - exhaustive price pairs", () => {
  const prices = [
    1, 10, 25, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 5000, 10000, 50000,
  ];
  let count = 0;

  for (const avg of prices) {
    for (const current of prices) {
      if (count >= 150) break;
      const longPnl = (current - avg) * 10;
      const shortPnl = (avg - current) * 10;
      test(`LONG avg=${avg} curr=${current} pnl=${longPnl}`, () => {
        const pos = {
          market: "BTC",
          liquidationPrice: 0,
          type: "LONG" as const,
          qty: 10,
          margin: 0,
          averagePrice: avg,
          leverage: 10,
        };
        expect(Pnl(pos, current)).toBe(longPnl);
      });
      test(`SHORT avg=${avg} curr=${current} pnl=${shortPnl}`, () => {
        const pos = {
          market: "BTC",
          liquidationPrice: 0,
          type: "SHORT" as const,
          qty: 10,
          margin: 0,
          averagePrice: avg,
          leverage: 10,
        };
        expect(Pnl(pos, current)).toBe(shortPnl);
      });
      count++;
    }
    if (count >= 150) break;
  }
});

// =============================================
// BULK: LiquidationPrice exhaustive
// =============================================

describe("Bulk LiquidationPrice - all combos", () => {
  const prices = [10, 50, 100, 200, 500, 1000, 10000, 100000];
  const leverages = [1, 2, 3, 5, 10, 20, 25, 50, 100];
  for (const price of prices) {
    for (const lev of leverages) {
      const liqPart = price / lev;
      test(`LONG price=${price} lev=${lev} => ${price - liqPart}`, () => {
        expect(LiqudationPrice(lev, 10, price, "LONG")).toBeCloseTo(
          price - liqPart,
          10,
        );
      });
      test(`SHORT price=${price} lev=${lev} => ${price + liqPart}`, () => {
        expect(LiqudationPrice(lev, 10, price, "SHORT")).toBeCloseTo(
          price + liqPart,
          10,
        );
      });
    }
  }
});

// =============================================
// INTEGRATION: multi-user order matching
// =============================================

describe("Integration - multi-user scenarios", () => {
  test("three users: maker1 sells, maker2 sells, taker buys all", () => {
    seedBalance("taker", 100000);
    seedBalance("maker1", 100000);
    seedBalance("maker2", 100000);

    const m1: openOrders = {
      userId: "maker1",
      qty: 8,
      filledQty: 0,
      orderId: "m1",
      createdAt: new Date(),
      leverage: 10,
    };
    const m2: openOrders = {
      userId: "maker2",
      qty: 5,
      filledQty: 0,
      orderId: "m2",
      createdAt: new Date(),
      leverage: 10,
    };
    const asks = new Map<
      number,
      { availableQty: number; openOrders: openOrders[] }
    >();
    asks.set(100, { availableQty: 8, openOrders: [m1] });
    asks.set(101, { availableQty: 5, openOrders: [m2] });
    Orderbook.set("BTC", {
      bids: new Map(),
      asks,
      lastTradedPrice: 100,
      indexprice: 100,
    });

    const result = CreateOrder("taker", 13, 10, null, "LONG", "BTC", "Market");
    expectCreateOrderSuccess(result);
    expect(result.executedqty).toBe(13);

    expect(Position.get("maker1")!.get("BTC")!.qty).toBe(8);
    expect(Position.get("maker2")!.get("BTC")!.qty).toBe(5);
    expect(Position.get("taker")!.get("BTC")!.qty).toBe(13);
  });

  test("taker limit order walks the book then rests", () => {
    seedBalance("user1", 100000);
    seedBalance("maker1", 100000);
    seedBalance("maker2", 100000);

    const m1: openOrders = {
      userId: "maker1",
      qty: 5,
      filledQty: 0,
      orderId: "m1",
      createdAt: new Date(),
      leverage: 10,
    };
    const m2: openOrders = {
      userId: "maker2",
      qty: 5,
      filledQty: 0,
      orderId: "m2",
      createdAt: new Date(),
      leverage: 10,
    };
    const asks = new Map<
      number,
      { availableQty: number; openOrders: openOrders[] }
    >();
    asks.set(100, { availableQty: 5, openOrders: [m1] });
    asks.set(101, { availableQty: 5, openOrders: [m2] });
    Orderbook.set("BTC", {
      bids: new Map(),
      asks,
      lastTradedPrice: 100,
      indexprice: 100,
    });

    const result = CreateOrder("user1", 8, 10, 101, "LONG", "BTC", "Limit");
    expectCreateOrderSuccess(result);
    // fills 5 at 100 and 3 at 101 (price 101 hits both levels)
    expect(result.executedqty).toBe(8);
    expect(result.remaningqty).toBe(0);
  });

  test("full round-trip: buy then sell same qty with profit", () => {
    seedBalance("user1", 100000);
    seedBalance("maker1", 100000);
    seedBalance("maker2", 100000);

    // Market sells at 100
    const m1: openOrders = {
      userId: "maker1",
      qty: 10,
      filledQty: 0,
      orderId: "m1",
      createdAt: new Date(),
      leverage: 10,
    };
    const asks = new Map<
      number,
      { availableQty: number; openOrders: openOrders[] }
    >();
    asks.set(100, { availableQty: 10, openOrders: [m1] });
    Orderbook.set("BTC", {
      bids: new Map(),
      asks,
      lastTradedPrice: 100,
      indexprice: 100,
    });

    // Buy 10 at market
    const buy = CreateOrder("user1", 10, 10, null, "LONG", "BTC", "Market");
    expectCreateOrderSuccess(buy);

    const pos = Position.get("user1")!.get("BTC")!;
    expect(pos.qty).toBe(10);

    // Close with profit at 150
    Balance.set("user1", { available: 100000, locked: pos.margin });
    const m2: openOrders = {
      userId: "maker2",
      qty: 10,
      filledQty: 0,
      orderId: "m2",
      createdAt: new Date(),
      leverage: 10,
    };
    const bids = new Map<
      number,
      { availableQty: number; openOrders: openOrders[] }
    >();
    bids.set(150, { availableQty: 10, openOrders: [m2] });
    Orderbook.set("BTC", {
      bids,
      asks: new Map(),
      lastTradedPrice: 150,
      indexprice: 150,
    });

    const sell = CreateOrder("user1", 10, 10, null, "SHORT", "BTC", "Market");
    expectCreateOrderSuccess(sell);
    expect(Position.get("user1")?.has("BTC")).toBe(false);
    expect(Balance.get("user1")!.available).toBeGreaterThan(100000);
  });
});

// =============================================
// EDGE: race conditions / repeated calls
// =============================================

describe("Repeated / concurrent-like calls", () => {
  test("UserBalanceLock called twice for same user locks cumulative margin", () => {
    seedBalance("user1", 100000);
    UserBalanceLock("user1", "LONG", "BTC", 10, 100, 10);
    UserBalanceLock("user1", "LONG", "BTC", 10, 100, 10);
    expect(Balance.get("user1")!.locked).toBe(200);
    expect(Balance.get("user1")!.available).toBe(100000 - 200);
  });

  test("UserBalanceLock after insufficient funds still deducts nothing", () => {
    seedBalance("user1", 50);
    UserBalanceLock("user1", "LONG", "BTC", 10, 100, 1);
    expect(Balance.get("user1")!.locked).toBe(0);
    expect(Balance.get("user1")!.available).toBe(50);
  });

  test("Position Map correctly handles multiple markets per user", () => {
    seedBalance("user1", 1_000_000);
    CheckPositionUpdates("user1", "BTC", "LONG", 100, 10, 10);
    CheckPositionUpdates("user1", "ETH", "LONG", 10, 100, 10);
    const userPos = Position.get("user1")!;
    expect(userPos.size).toBe(2);
    expect(userPos.get("BTC")!.qty).toBe(10);
    expect(userPos.get("ETH")!.qty).toBe(100);
  });
});

// =============================================
// EDGE: Orderbook state after fills
// =============================================

describe("Orderbook state after fills", () => {
  test("ask level fully consumed is removed from orderbook", () => {
    seedBalance("user1", 100000);
    seedBalance("maker1", 100000);
    seedOrderbook("BTC", 50000, [], [[100, 5]]);
    CreateOrder("user1", 5, 10, null, "LONG", "BTC", "Market");
    const book = Orderbook.get("BTC")!;
    expect(book.asks.has(100)).toBe(false);
  });

  test("ask level partially consumed stays with reduced qty", () => {
    seedBalance("user1", 100000);
    seedBalance("maker1", 100000);
    seedOrderbook("BTC", 50000, [], [[100, 10]]);
    CreateOrder("user1", 4, 10, null, "LONG", "BTC", "Market");
    const book = Orderbook.get("BTC")!;
    expect(book.asks.has(100)).toBe(true);
    expect(book.asks.get(100)!.availableQty).toBe(6);
  });

  test("bid level fully consumed is removed for SHORT", () => {
    seedBalance("user1", 100000);
    seedBalance("maker1", 100000);
    seedOrderbook("BTC", 50000, [[100, 5]], []);
    CreateOrder("user1", 5, 10, null, "SHORT", "BTC", "Market");
    const book = Orderbook.get("BTC")!;
    expect(book.bids.has(100)).toBe(false);
  });
});

// Formatted project activity log output at 2026-06-08 23:56:59
