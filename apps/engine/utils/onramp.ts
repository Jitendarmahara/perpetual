import { Balance, Orderbook } from "../stor/echangestore";

export async function OnRamp(userId: string, amount: number) {
  let balance = Balance.get(userId);
  if (!balance) {
    // Auto-init on first deposit (e.g. after engine restart with a live session)
    balance = { available: 0, locked: 0 };
    Balance.set(userId, balance);
  }
  balance.available += amount;
  return {
    success: true as const,
    amount: amount,
    error: undefined,
  };
}
export function initalizedMarket(
  market: string,
  lastTradedPrice: number,
  indexprice: number,
) {
  if (Orderbook.has(market)) {
    return { success: false, error: "market already exists" };
  }
  Orderbook.set(market, {
    bids: new Map(),
    asks: new Map(),
    lastTradedPrice,
    indexprice,
  });
  return { success: true };
}

export async function initalizedBalnce(userId: string) {
  if (!Balance.has(userId)) {
    Balance.set(userId, {
      available: 0,
      locked: 0,
    });
  }
  return {
    success: true,
  };
}

// Formatted project activity log output at 2026-06-07 00:06:03
