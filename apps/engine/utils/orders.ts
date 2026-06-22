import { Balance, Orderbook } from "../stor/echangestore";
import type { openOrders } from "../types/types";

export function DeleteOrder(orderId: string, userId: string, market: string) {
  const book = Orderbook.get(market);
  if (!book) {
    return {
      success: false,
      error: "order book not found",
    };
  }
  const balance = Balance.get(userId);
  if (!balance) {
    return {
      success: false,
      error: "user balance not found",
    };
  }
  //finding the orderid in the asks table;
  let resolve: boolean = false;
  let cancelledSide: "ask" | "bid" | null = null;
  let cancelledPrice: number | null = null;
  const ask = book.asks;
  const bid = book.bids;
  const sortedarray = Array.from(ask.keys()).sort((a, b) => a - b);
  for (const levelprice of sortedarray) {
    if (resolve) {
      break;
    }
    const order = book.asks.get(levelprice);
    if (!order) {
      return {
        success: false,
        error: "order not found",
      };
    }
    for (const restingorder of order.openOrders) {
      if (resolve) {
        break;
      }
      if (restingorder.orderId === orderId && restingorder.userId === userId) {
        const remainingorder = order.openOrders.filter(
          (x) => x.orderId !== orderId,
        );
        order.availableQty = remainingorder.reduce(
          (sum, x) => sum + (x.qty - x.filledQty),
          0,
        );
        if (remainingorder.length === 0) {
          book.asks.delete(levelprice);
        }
        order.openOrders = remainingorder;
        const remaningqty = restingorder.qty - restingorder.filledQty;
        const originalMargin = restingorder.marginLocked !== undefined
          ? restingorder.marginLocked
          : (restingorder.qty * levelprice) / restingorder.leverage;
        const refund = restingorder.qty > 0 ? originalMargin * (remaningqty / restingorder.qty) : 0;
        balance.available += refund;
        balance.locked = Math.max(0, balance.locked - refund);
        resolve = true;
        cancelledSide = "ask";
        cancelledPrice = levelprice;
      }
    }
  }
  // check in the bids table if order exits or not;
  if (!resolve) {
    const sortedbids = Array.from(bid.keys()).sort((a, b) => b - a);
    for (const levelprice of sortedbids) {
      if (resolve) {
        break;
      }
      const order = book.bids.get(levelprice);
      if (!order) {
        return {
          success: false,
          error: "user order not found",
        };
      }
      for (const restingorder of order.openOrders) {
        if (resolve) {
          break;
        }
        if (
          restingorder.orderId === orderId &&
          restingorder.userId === userId
        ) {
          const remainingorder = order.openOrders.filter(
            (x) => x.orderId !== orderId,
          );
          order.availableQty = remainingorder.reduce(
            (sum, x) => sum + (x.qty - x.filledQty),
            0,
          );
          if (remainingorder.length === 0) {
            book.bids.delete(levelprice);
          }
          order.openOrders = remainingorder;
          const remaningqty = restingorder.qty - restingorder.filledQty;
          const originalMargin = restingorder.marginLocked !== undefined
            ? restingorder.marginLocked
            : (restingorder.qty * levelprice) / restingorder.leverage;
          const refund = restingorder.qty > 0 ? originalMargin * (remaningqty / restingorder.qty) : 0;
          balance.available += refund;
          balance.locked = Math.max(0, balance.locked - refund);
          resolve = true;
          cancelledSide = "bid";
          cancelledPrice = levelprice;
        }
      }
    }
  }
  if (!resolve) {
    return {
      success: false,
      error: "order not found",
    };
  } else {
    const remainingQty =
      cancelledSide === "ask"
        ? book.asks.get(cancelledPrice!)?.availableQty ?? 0
        : book.bids.get(cancelledPrice!)?.availableQty ?? 0;
    return {
      success: true,
      data: "order remvoed successfully",
      side: cancelledSide!,
      price: cancelledPrice!,
      remainingQty,
    };
  }
}

export function OpenOrders(market: string, userId: string) {
  const book = Orderbook.get(market);
  if (!book) {
    return {
      success: false,
      error: "orderbook not found",
    };
  }
  const orders: (openOrders & { side: "ask" | "bid"; price: number })[] = [];
  for (const [price, value] of book.asks) {
    for (const order of value.openOrders) {
      if (order.userId === userId) {
        orders.push({ ...order, side: "ask", price });
      }
    }
  }
  for (const [price, value] of book.bids) {
    for (const order of value.openOrders) {
      if (order.userId === userId) {
        orders.push({ ...order, side: "bid", price });
      }
    }
  }
  return {
    success: true,
    orders,
  };
}
