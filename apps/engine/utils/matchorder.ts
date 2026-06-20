import { Balance, Orderbook, Position } from "../stor/echangestore";
import type { openOrders, positions } from "../types/types";
import { randomUUID } from "crypto";
import { CheckPositionUpdates } from "./positionupdate";
import { createClient, Type, type FillData, type OrderUpdate } from "@repo/redis_data";

export type EngineStreamEvent = Record<string, unknown>;

export type CreateOrderResult =
  | { success: false; error: string }
  | {
      success: true;
      executedqty: number;
      remaningqty: number;
      events: EngineStreamEvent[];
    };


let client:any;
async function getClient() {
  if (!client) {
    client = await createClient();
  }
  return client;
}

export async function PublishEngineEvents(events: EngineStreamEvent[]) {
  const c = await getClient();
  for (const event of events) {
    await c.xAdd("events_stream", "*", { data: JSON.stringify(event) });
  }
}

// this function decides how much to lock or not ;
export function UserBalanceLock(
  userId: string,
  type: "LONG" | "SHORT",
  market: string,
  qty: number,
  price: number,
  leverage: number,
) {
  const positions = Position.get(userId)?.get(market);
  let balance = Balance.get(userId);
  if (!balance) {
    balance = { available: 0, locked: 0 };
    Balance.set(userId, balance);
  }
  if (!positions) {
    // openign a new position;
    const margin = (price * qty) / leverage;
    if (balance.available < margin) {
      return {
        success: false,
        error: "Insufficient funds",
      };
    } else {
      balance.available -= margin;
      balance.locked += margin;
      return {
        success: true,
      };
    }
  } else if (positions.type === type) {
    const extramargin = (qty * price) / leverage;
    if (balance.available < extramargin) {
      return {
        success: false,
        error: "Insufficient funds",
      };
    }
    balance.available -= extramargin;
    balance.locked += extramargin;

    return {
      success: true,
    };
  } else if (positions.type !== type && qty > positions.qty) {
    const extraqty = Math.abs(qty - positions.qty);
    const margin = (price * extraqty) / leverage;
    if (balance.available < margin) {
      return {
        success: false,
        error: "insufficient funds",
      };
    }
    balance.available -= margin;
    balance.locked += margin;
    return {
      success: true,
    };
  }
  return {
    success: true,
  };
}
// this functions traverse the ordrbook and tryes to fill the
export function CreateOrder(
  userId: string,
  qty: number,
  leverage: number,
  price: number | null,
  type: "LONG" | "SHORT",
  market: string,
  ordertype: "Limit" | "Market",
): CreateOrderResult {
  if (!Number.isFinite(qty) || qty <= 0) {
    return {
      success: false,
      error: "invalid quantity",
    };
  }

  if (!Number.isFinite(leverage) || leverage <= 0) {
    return {
      success: false,
      error: "invalid leverage",
    };
  }

  const orderId = randomUUID();
  const markprice = Orderbook.get(market)?.lastTradedPrice;
  if (markprice === undefined) {
    return {
      success: false,
      error: "lasttraded price not found",
    };
  }
  const effectiveprice = ordertype === "Limit" ? price : markprice;
  if (effectiveprice === null) {
    return {
      success: false,
      error: "Price needed for the limit order",
    };
  }
  // lock the user balance at this effective price;
  const book = Orderbook.get(market);
  if (!book) {
    return {
      success: false,
      error: "orderbook not found",
    };
  }
  let oppositebook = type === "LONG" ? book.asks : book.bids;
  // on the bases of the book we have sorted the price keys
  const sortedarray = Array.from(oppositebook.keys()).sort((a, b) => {
    if (type === "LONG") {
      return a - b;
    } else {
      return b - a;
    }
  });

  let totalfilledavaliable = 0;
  let estimedprice = 0;
  if (ordertype === "Market") {
    for (const levelprice of sortedarray) {
      if (totalfilledavaliable >= qty) {
        break;
      }
      const order = oppositebook.get(levelprice);
      if (!order) {
        return {
          success: false,
          error: "user order not found",
        };
      }
      for (const restingorder of order.openOrders) {
        const minfilled = Math.min(
          qty - totalfilledavaliable,
          restingorder.qty - restingorder.filledQty,
        );
        totalfilledavaliable += minfilled;
        estimedprice += minfilled * levelprice;
        if (totalfilledavaliable >= qty) {
          break;
        }
      }
    }
  }
  if (totalfilledavaliable === 0 && ordertype === "Market") {
    return {
      success: false,
      error: "Insufficient order",
    };
  }
  let lockqty = ordertype === "Limit" ? qty : totalfilledavaliable;
  let lockprice =
    ordertype === "Limit" ? price : estimedprice / totalfilledavaliable;

  if (!lockprice) {
    return {
      success: false,
      error: "Price needed for Limit order",
    };
  }
  const balanceBefore = Balance.get(userId);
  const initialLocked = balanceBefore ? balanceBefore.locked : 0;
  const data = UserBalanceLock(
    userId,
    type,
    market,
    lockqty,
    lockprice,
    leverage,
  );
  if (!data?.success) {
    return { success: false, error: data?.error ?? "balance lock failed" };
  }
  const balanceAfter = Balance.get(userId);
  const finalLocked = balanceAfter ? balanceAfter.locked : 0;
  const marginDelta = Math.max(0, finalLocked - initialLocked);

  const events: EngineStreamEvent[] = [
    {
      type: Type.CREATE_ORDER,
      order: {
        id: orderId,
        userId,
        marketId: market,
        type: ordertype,
        side: type,
        price: effectiveprice.toString(),
        qty: lockqty.toString(),
        filledqty: 0,
        status: "OPEN",
        leverage,
      },
    },
  ];

  let executedqty = 0;
  let fills: FillData[] = [];
  // record of all the users ;
  const orderUpdates: OrderUpdate[] = [];
  const matchedLevels = new Set<number>();
  for (const levelprice of sortedarray) {
    if (executedqty >= lockqty) {
      break;
    }
    if (
      ordertype === "Limit" &&
      type === "LONG" &&
      effectiveprice < levelprice
    ) {
      break;
    }
    if (
      ordertype === "Limit" &&
      type === "SHORT" &&
      effectiveprice > levelprice
    ) {
      break;
    }
    const order = oppositebook.get(levelprice);
    if (!order) {
      return {
        success: false,
        error: "order level not found",
      };
    }
    matchedLevels.add(levelprice);
    for (const restingorder of order.openOrders) {
      if (executedqty >= lockqty) {
        break;
      }
      const minfilled = Math.min(
        lockqty - executedqty,
        restingorder.qty - restingorder.filledQty,
      );
      executedqty += minfilled;
      restingorder.filledQty += minfilled;
      const fill: FillData = {
        id: randomUUID(),
        maker_id: restingorder.userId,
        taker_id: userId,
        price: levelprice.toString(),
        qty: minfilled.toString(),
        maker_order_id: restingorder.orderId,
        taker_order_id: orderId,
        marketId: market,
        executedAt: new Date().toISOString(),
      };
      fills.push(fill);
      // update the taker positon
      const makerorderupdate: OrderUpdate = {
        orderId: restingorder.orderId,
        filledqty: restingorder.filledQty,
        qty: restingorder.qty,
        status:
          restingorder.qty === restingorder.filledQty
            ? "filled"
            : "partially_filled",
      };
      orderUpdates.push(makerorderupdate);
      const res = CheckPositionUpdates(
        userId,
        market,
        type,
        levelprice,
        minfilled,
        leverage,
      );
      if (!res?.success) {
        return {
          success: false,
          error: res?.error ?? "taker position update failed",
        };
      }
      const result = CheckPositionUpdates(
        restingorder.userId,
        market,
        type === "LONG" ? "SHORT" : "LONG",
        levelprice,
        minfilled,
        restingorder.leverage ?? leverage,
      );
      if (!result?.success) {
        return {
          success: false,
          error: result?.error ?? "maker position update failed",
        };
      }
    }
    // update the level orders
    order.openOrders = order.openOrders.filter((x) => x.filledQty < x.qty);
    order.availableQty = order.openOrders.reduce(
      (sum, x) => sum + (x.qty - x.filledQty),
      0,
    );
    if (order.availableQty === 0) {
      oppositebook.delete(levelprice);
    }
  }
  orderUpdates.unshift({
    orderId,
    filledqty: executedqty,
    qty,
    status: executedqty === qty ? "filled" : "partially_filled",
  });

  const bidsDepth: [string, string][] = [];
  const asksDepth: [string, string][] = [];

  // 1. Process matched opposite levels
  for (const levelprice of matchedLevels) {
    const remainingQty = oppositebook.get(levelprice)?.availableQty ?? 0;
    if (type === "LONG") {
      asksDepth.push([levelprice.toString(), remainingQty.toString()]);
    } else {
      bidsDepth.push([levelprice.toString(), remainingQty.toString()]);
    }
  }

  const remaningqty = lockqty - executedqty;

  if (remaningqty > 0 && ordertype === "Limit") {
    const ownbook = type === "LONG" ? book.bids : book.asks;
    const OrderAtLevel = ownbook.get(effectiveprice);

    const restingMarginLocked = marginDelta * (remaningqty / lockqty);

    const neworder: openOrders = {
      userId,
      qty: remaningqty,
      filledQty: 0,
      orderId: orderId,
      createdAt: new Date(),
      leverage,
      marginLocked: restingMarginLocked,
    };
    if (OrderAtLevel) {
      OrderAtLevel.availableQty += remaningqty;
      OrderAtLevel.openOrders.push(neworder);
    } else {
      ownbook.set(effectiveprice, {
        availableQty: remaningqty,
        openOrders: [neworder],
      });
    }

    // 2. Process own level if resting quantity is added
    const currentQty = ownbook.get(effectiveprice)?.availableQty ?? 0;
    if (type === "LONG") {
      bidsDepth.push([effectiveprice.toString(), currentQty.toString()]);
    } else {
      asksDepth.push([effectiveprice.toString(), currentQty.toString()]);
    }
  }

  events.push({
      type: Type.FILL,
      marketId: market,
      fills,
      orderUpdates,
      bids: bidsDepth,
      asks: asksDepth,
  });
  return {
    success: true,
    executedqty,
    remaningqty: lockqty - executedqty,
    events,
  };
}

export function LiqudationPrice(
  leverage: number,
  _qty: number,
  price: number,
  type: "LONG" | "SHORT",
) {
  if (!Number.isFinite(leverage) || leverage <= 0) {
    throw new Error("invalid leverage");
  }

  const liqudationprice = price / leverage;
  if (type === "LONG") {
    return price - liqudationprice;
  } else {
    return price + liqudationprice;
  }
}
export function CalculateAveragePrice(
  qty: number,
  price: number,
  oldAverage: number,
  oldQty: number,
) {
  return (qty * price + oldAverage * oldQty) / (qty + oldQty);
}
