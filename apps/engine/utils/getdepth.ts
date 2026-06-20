// this functin send the bid  and asks aree that this much of quanity

import { Orderbook } from "../stor/echangestore";

export function GetDepth(market: string) {
  let bid: [number, number][] = [];
  let ask: [number, number][] = [];

  // traverse the orderbook and find the the toatl avaliable qty at that pirce;
  const orderbook = Orderbook.get(market);
  if (!orderbook) {
    return {
      success: false,
      error: "orderbook not found",
    };
  }
  const sortedbids = Array.from(orderbook.bids.keys()).sort((a, b) => b - a); // largest price first
  const sortedasks = Array.from(orderbook.asks.keys()).sort((a, b) => a - b); // lower first;
  for (const levelprice of sortedbids) {
    const qty = orderbook.bids.get(levelprice)?.availableQty;
    if (!qty) continue;
    bid.push([levelprice, qty]);
  }

  for (const levelprice of sortedasks) {
    const qty = orderbook.asks.get(levelprice)?.availableQty;
    if (!qty) continue;
    ask.push([levelprice, qty]);
  }
  return {
    success: true,
    bids: bid,
    asks: ask,
    markPrice: orderbook.indexprice,
    lastTradedPrice: orderbook.lastTradedPrice,
  };
}
