import { client } from "@repo/db/client";
import { Type, type FillData, type OrderUpdate } from "@repo/redis_data";

export const STREAM_NAME = "events_stream";
export const GROUP_NAME = "db-group";
export const CONSUMER_ID = "db-poller";
export const READ_COUNT = 10;

export type StreamMessage = {
  id: string;
  message: Record<string, string>;
};

export type DbOrderStatus =
  | "OPEN"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "CANCELLED";

type CreateOrderEvent = {
  type: Type.CREATE_ORDER;
  order?: {
    id: string;
    userId: string;
    marketId: string;
    type: "Limit" | "Market";
    side: "LONG" | "SHORT";
    price: string;
    qty: string;
    filledqty: number;
    status: string;
  };
};

type FillEvent = {
  type: Type.FILL;
  fills: FillData[];
  orderUpdates: OrderUpdate[];
};

type CancelOrderEvent = {
  type: Type.CANCLE_ORDER;
  success?: boolean;
  orderId?: string;
};

type PersistableEvent = CreateOrderEvent | FillEvent | CancelOrderEvent;

export function parseEvent(data: string): PersistableEvent {
  return JSON.parse(data) as PersistableEvent;
}

function mapStatus(status?: string): DbOrderStatus {
  switch (status) {
    case "OPEN":
    case "open":
      return "OPEN";
    case "PARTIALLY_FILLED":
    case "partially_filled":
      return "PARTIALLY_FILLED";
    case "FILLED":
    case "filled":
      return "FILLED";
    case "CANCELLED":
    case "cancelled":
      return "CANCELLED";
    default:
      return "OPEN";
  }
}

async function getMarketId(marketSlug: string) {
  const market = await client.market.upsert({
    where: { market_slug: marketSlug },
    update: {},
    create: { market_slug: marketSlug },
  });

  return market.id;
}

async function ensureUser(userId: string) {
  await client.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      username: `${userId}@system.local`,
      password: "system",
      role: "User",
    },
  });
}

async function saveCreateOrderEvent(event: CreateOrderEvent) {
  const order = event.order;
  if (!order) return;

  const marketId = await getMarketId(order.marketId);
  await ensureUser(order.userId);

  await client.orders.upsert({
    where: { id: order.id },
    update: {
    },
    create: {
      id: order.id,
      userId: order.userId,
      type: order.type,
      price: order.price,
      qty: order.qty,
      filledqty: order.filledqty ,
      status: mapStatus(order.status),
      side: order.side,
      marketId,
    },
  });
}

async function saveFillEvent(event: FillEvent) {
  await client.$transaction(async (tx) => {
    const marketIds = new Map<string, string>();

    async function marketIdFor(marketSlug: string) {
      const existing = marketIds.get(marketSlug);
      if (existing) return existing;

      const market = await tx.market.upsert({
        where: { market_slug: marketSlug },
        update: {},
        create: { market_slug: marketSlug },
      });
      marketIds.set(marketSlug, market.id);
      return market.id;
    }

    for (const fill of event.fills) {
      const marketId = await marketIdFor(fill.marketId);
      await tx.user.upsert({
        where: { id: fill.maker_id },
        update: {},
        create: {
          id: fill.maker_id,
          username: `${fill.maker_id}@system.local`,
          password: "system",
          role: "User",
        },
      });
      await tx.user.upsert({
        where: { id: fill.taker_id },
        update: {},
        create: {
          id: fill.taker_id,
          username: `${fill.taker_id}@system.local`,
          password: "system",
          role: "User",
        },
      });
      await tx.fills.upsert({
        where: { id: fill.id },
        update: {},
        create: {
          id: fill.id,
          maker_id: fill.maker_id,
          taker_id: fill.taker_id,
          price: fill.price,
          qty: fill.qty,
          maker_order_id: fill.maker_order_id,
          taker_order_id: fill.taker_order_id,
          marketId,
        },
      });
      await tx.$executeRaw`
        INSERT INTO trades (id, market_id, price, qty, executed_at)
        VALUES (${fill.id}, ${marketId}, ${Number(fill.price)}, ${Number(fill.qty)}, ${new Date(fill.executedAt)})
        ON CONFLICT (id, executed_at) DO NOTHING
      `;
    }

    for (const orderUpdate of event.orderUpdates) {
      await tx.orders.updateMany({
        where: { id: orderUpdate.orderId },
        data: {
          filledqty: orderUpdate.filledqty,
          status: mapStatus(orderUpdate.status),
        },
      });
    }
  });
}

async function saveCancelOrderEvent(event: CancelOrderEvent) {
  if (!event.success || !event.orderId) return;

  await client.orders.update({
    where: { id: event.orderId },
    data: { status: "CANCELLED" },
  });
}

export async function saveEvent(event: PersistableEvent) {
  if (event.type === Type.CREATE_ORDER) {
    await saveCreateOrderEvent(event);
    return;
  }

  if (event.type === Type.FILL) {
    await saveFillEvent(event);
    return;
  }

  if (event.type === Type.CANCLE_ORDER) {
    await saveCancelOrderEvent(event);
  }
}
