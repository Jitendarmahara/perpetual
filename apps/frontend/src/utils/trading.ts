import type { BackendOrder, OrderBookLevel, Side } from "../types/trading";

export const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const normalizeOrderSide = (side: BackendOrder["side"]): Side =>
  side === "SHORT" || side === "ask" ? "SHORT" : "LONG";

export const mergeIncrementalDepth = (
  current: OrderBookLevel[],
  updates: unknown,
  sort: "asc" | "desc",
  limit = 10,
): OrderBookLevel[] => {
  const normalized = normalizeDepthLevels(updates);
  const priceMap = new Map<number, number>();
  for (const lvl of current) {
    if (Number.isFinite(lvl.price) && Number.isFinite(lvl.qty) && lvl.qty > 0) {
      priceMap.set(lvl.price, lvl.qty);
    }
  }
  for (const [price, qty] of normalized) {
    if (qty <= 0) {
      priceMap.delete(price);
    } else {
      priceMap.set(price, qty);
    }
  }
  let sum = 0;
  return Array.from(priceMap.entries())
    .map(([price, qty]) => ({ price, qty, total: 0 }))
    .sort((a, b) => sort === "asc" ? a.price - b.price : b.price - a.price)
    .slice(0, limit)
    .map((lvl) => { sum += lvl.qty; return { ...lvl, total: sum }; });
};

export const normalizeDepthLevels = (levels: unknown): [number, number][] => {
  if (!Array.isArray(levels)) return [];
  return levels.flatMap((level) => {
    if (!Array.isArray(level) || level.length < 2) return [];
    const price = toNumber(level[0], NaN);
    const qty = toNumber(level[1], NaN);
    return Number.isFinite(price) && Number.isFinite(qty)
      ? ([[price, qty]] as [number, number][])
      : [];
  });
};

export const buildOrderBookSide = (
  levels: unknown,
  sort: "asc" | "desc",
  limit = 10,
): OrderBookLevel[] => {
  const normalized = normalizeDepthLevels(levels);
  const priceMap = new Map<number, number>();
  for (const [price, qty] of normalized) {
    priceMap.set(price, (priceMap.get(price) ?? 0) + qty);
  }
  let sum = 0;
  return Array.from(priceMap.entries())
    .map(([price, qty]) => ({ price, qty, total: 0 }))
    .sort((a, b) => sort === "asc" ? a.price - b.price : b.price - a.price)
    .slice(0, limit)
    .map((lvl) => { sum += lvl.qty; return { ...lvl, total: sum }; });
};
