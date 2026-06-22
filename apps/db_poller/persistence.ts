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

async function saveCreateOrderEvent(event: CreateOrderEvent) {
  const order = event.order;
  if (!order) return;

  const marketId = await getMarketId(order.marketId);

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
  const marketIds = new Map<string, string>(); // this is just to save the extra db calls for the same markte again //not my thinking 

  async function marketIdFor(marketSlug: string) {
    const existing = marketIds.get(marketSlug);
    if (existing) return existing;

    const marketId = await getMarketId(marketSlug);
    marketIds.set(marketSlug, marketId);
    return marketId;
  }

  for (const fill of event.fills) {
    const marketId = await marketIdFor(fill.marketId); // the market id her is slug name of that market only;
// update with prisma transaction
    await client.fills.upsert({
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
  }

  for (const orderUpdate of event.orderUpdates) {
    await client.orders.update({
      where: { id: orderUpdate.orderId },
      data: {
        filledqty: orderUpdate.filledqty,
        status: mapStatus(orderUpdate.status),
      },
    });
  }
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

// Optimized memory tracking configurations at 2026-06-08 23:56:59
