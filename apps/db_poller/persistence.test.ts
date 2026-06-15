import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Type } from "@repo/redis_data";

type Calls = {
  marketUpserts: any[];
  fillUpserts: any[];
  tradeInserts: any[];
  orderUpdates: any[];
  orderUpserts: any[];
};

function createCalls(): Calls {
  return {
    marketUpserts: [],
    fillUpserts: [],
    tradeInserts: [],
    orderUpdates: [],
    orderUpserts: [],
  };
}

let calls = createCalls();
let failOrderUpsert = false;

mock.module("@repo/db/client", () => ({
  client: {
    market: {
      upsert: async (args: any) => {
        calls.marketUpserts.push(args);
        return { id: `market-${args.where.market_slug}` };
      },
    },
    fills: {
      upsert: async (args: any) => {
        calls.fillUpserts.push(args);
      },
    },
    $executeRaw: async (...args: any[]) => {
      calls.tradeInserts.push(args);
    },
    orders: {
      update: async (args: any) => {
        calls.orderUpdates.push(args);
      },
      upsert: async (args: any) => {
        calls.orderUpserts.push(args);
        if (failOrderUpsert) throw new Error("db down");
      },
    },
  },
}));

const { saveEvent } = await import("./persistence");

function resetFakeClient(options: { failOrderUpsert?: boolean } = {}) {
  calls = createCalls();
  failOrderUpsert = options.failOrderUpsert ?? false;
  return calls;
}

describe("DB poller persistence", () => {
  beforeEach(() => {
    resetFakeClient();
  });

  test("saves a created order", async () => {
    const calls = resetFakeClient();

    await saveEvent(
      {
        type: Type.CREATE_ORDER,
        order: {
          id: "order-1",
          userId: "user-1",
          marketId: "BTC",
          type: "Limit",
          side: "LONG",
          price: "100",
          qty: "2",
          filledqty: 0,
          status: "open",
        },
      },
    );

    expect(calls.marketUpserts).toHaveLength(1);
    expect(calls.orderUpserts[0].create).toMatchObject({
      id: "order-1",
      filledqty: 0,
      status: "OPEN",
      marketId: "market-BTC",
    });
  });

  test("throws when the DB write fails", async () => {
    resetFakeClient({ failOrderUpsert: true });

    await expect(
      saveEvent(
        {
          type: Type.CREATE_ORDER,
          order: {
            id: "order-1",
            userId: "user-1",
            marketId: "BTC",
            type: "Limit",
            side: "LONG",
            price: "100",
            qty: "2",
            filledqty: 0,
            status:"OPEN"
          },
        },
      ),
    ).rejects.toThrow("db down");
  });

  test("saves fills and updates order status", async () => {
    const calls = resetFakeClient();
    const executedAt = "2026-06-07T07:00:00.000Z";

    await saveEvent(
      {
        type: Type.FILL,
        fills: [
          {
            id: "fill-1",
            maker_id: "maker",
            taker_id: "taker",
            price: "100",
            qty: "3",
            maker_order_id: "maker-order",
            taker_order_id: "taker-order",
            marketId: "BTC",
            executedAt,
          },
        ],
        orderUpdates: [
          {
            orderId: "maker-order",
            filledqty: 3,
            qty: 3,
            status: "filled",
          },
        ],
      },
    );

    expect(calls.fillUpserts[0].where.id).toBe("fill-1");
    expect(calls.fillUpserts[0].create.marketId).toBe("market-BTC");
    expect(calls.tradeInserts).toHaveLength(1);
    expect(calls.tradeInserts[0]).toContain("fill-1");
    expect(calls.tradeInserts[0]).toContain("market-BTC");
    expect(calls.tradeInserts[0]).toContain("100");
    expect(calls.tradeInserts[0]).toContain("3");
    expect(calls.orderUpdates[0].data).toMatchObject({
      filledqty: 3,
      status: "FILLED",
    });
  });

  test("marks a cancelled order only when cancel succeeded", async () => {
    const calls = resetFakeClient();

    await saveEvent(
      {
        type: Type.CANCLE_ORDER,
        success: false,
        orderId: "order-1",
      },
    );
    await saveEvent(
      {
        type: Type.CANCLE_ORDER,
        success: true,
        orderId: "order-1",
      },
    );

    expect(calls.orderUpdates).toEqual([
      {
        where: { id: "order-1" },
        data: { status: "CANCELLED" },
      },
    ]);
  });
});
