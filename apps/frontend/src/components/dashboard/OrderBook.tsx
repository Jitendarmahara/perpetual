"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import type { OpenOrder, OrderBookLevel } from "../../types/trading";

interface OrderBookProps {
  market: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  maxTotalVolume: number;
  lastTradedPrice: number;
  marketError: string | null;
  openOrders: OpenOrder[];
  onPriceClick: (price: number) => void;
}

const priceKey = (price: number) => price.toFixed(8);

type DisplayLevel = OrderBookLevel & {
  isUserOrder: boolean;
  userQty: number;
};

const remainingQty = (order: OpenOrder) =>
  Math.max(0, order.qty - order.filledQty);

function buildDisplayLevels(
  levels: OrderBookLevel[],
  userOrders: OpenOrder[],
): DisplayLevel[] {
  const levelMap = new Map<string, DisplayLevel>();
  for (const lvl of levels) {
    if (!Number.isFinite(lvl.price) || !Number.isFinite(lvl.qty) || lvl.qty <= 0) {
      continue;
    }
    levelMap.set(priceKey(lvl.price), {
      ...lvl,
      isUserOrder: false,
      userQty: 0,
    });
  }

  for (const order of userOrders) {
    const qty = remainingQty(order);
    if (!Number.isFinite(order.price) || order.price <= 0 || qty <= 0) continue;

    const key = priceKey(order.price);
    const existing = levelMap.get(key);
    if (existing) {
      existing.isUserOrder = true;
      existing.userQty += qty;
    } else {
      levelMap.set(key, {
        price: order.price,
        qty,
        total: 0,
        isUserOrder: true,
        userQty: qty,
      });
    }
  }

  let total = 0;
  return Array.from(levelMap.values())
    .sort((a, b) => b.price - a.price)
    .map((lvl) => {
      total += lvl.qty;
      return { ...lvl, total };
    });
}

function Level({
  lvl,
  side,
  max,
  onClick,
}: {
  lvl: DisplayLevel;
  side: "bid" | "ask";
  max: number;
  onClick: () => void;
}) {
  const pct = Math.min((lvl.total / max) * 100, 100);
  const depthBg =
    side === "bid"
      ? "rgba(2,192,118,0.10)"
      : "rgba(248,73,96,0.10)";
  const priceClass = side === "bid" ? "text-bull" : "text-bear";

  return (
    <div
      onClick={onClick}
      className={`relative grid grid-cols-3 px-3 py-[2px] font-mono text-[11px] transition cursor-pointer ${
        lvl.isUserOrder
          ? "bg-purple-500/25 ring-1 ring-inset ring-purple-300/80 shadow-[inset_0_0_18px_rgba(168,85,247,0.16)] hover:bg-purple-500/30"
          : "hover:bg-surface-2/60"
      }`}
    >
      <div
        className="absolute right-0 top-0 h-full pointer-events-none"
        style={{ width: `${pct}%`, background: depthBg }}
      />
      {lvl.isUserOrder && (
        <div className="absolute left-0 top-0 h-full w-1 bg-purple-400 pointer-events-none" />
      )}
      <span className={`relative font-semibold ${priceClass}`}>
        ${lvl.price.toFixed(2)}
      </span>
      <span className="relative text-right text-[#f5f6f7]">{lvl.qty.toFixed(2)}</span>
      <span className={`relative text-right text-[10px] ${lvl.isUserOrder ? "text-purple-200 font-bold" : "text-muted-foreground"}`}>
        {lvl.isUserOrder ? `YOU ${lvl.userQty.toFixed(2)}` : lvl.total.toFixed(2)}
      </span>
    </div>
  );
}

export function OrderBook({
  market,
  bids,
  asks,
  maxTotalVolume,
  lastTradedPrice,
  marketError,
  openOrders,
  onPriceClick,
}: OrderBookProps) {
  const userBids = openOrders.filter(
    (order) => order.market === market && order.side === "LONG",
  );
  const userAsks = openOrders.filter(
    (order) => order.market === market && order.side === "SHORT",
  );
  const displayAsks = buildDisplayLevels(asks, userAsks);
  const displayBids = buildDisplayLevels(bids, userBids);
  const displayMaxTotalVolume = Math.max(
    maxTotalVolume,
    displayAsks.reduce((acc, lvl) => Math.max(acc, lvl.total), 0),
    displayBids.reduce((acc, lvl) => Math.max(acc, lvl.total), 0),
    1,
  );
  const spread = Math.max(
    0,
    (asks[asks.length - 1]?.price ?? 0) - (bids[0]?.price ?? 0),
  );

  return (
    <div className="h-[460px] min-h-[460px] shrink-0 overflow-hidden rounded-lg border border-border bg-surface/20 flex flex-col">
      {/* Header */}
      <div className="h-9 border-b border-border bg-surface/40 flex items-center justify-between px-3 shrink-0">
        <span className="text-xs font-semibold text-[#f5f6f7] uppercase tracking-wider">
          Order Book
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">
          {market.replace("_", "-")}
        </span>
      </div>

      {/* Column labels */}
      <div className="grid grid-cols-3 px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/50 bg-surface/20">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      <div className="flex-1 flex flex-col font-mono text-xs">
        {marketError && (
          <div className="m-3 rounded-xl border border-bear/20 bg-bear/10 px-3 py-2 text-[11px] text-bear">
            {marketError}
          </div>
        )}

        {/* Asks */}
        <div className="flex-1 min-h-0 flex flex-col justify-end pb-0.5 overflow-hidden">
          {displayAsks.length === 0 ? (
            <div className="text-center text-muted-foreground/60 text-xs py-4">
              No asks loaded
            </div>
          ) : (
            displayAsks.map((lvl, i) => (
              <Level
                key={`ask-${priceKey(lvl.price)}-${i}`}
                lvl={lvl}
                side="ask"
                max={displayMaxTotalVolume}
                onClick={() => onPriceClick(lvl.price)}
              />
            ))
          )}
        </div>

        {/* Spread / last price row */}
        <div className="px-3 py-2 border-y border-border bg-surface/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-base font-bold text-[#f5f6f7]">
              $
              {lastTradedPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            {spread === 0 ? (
              <TrendingUp className="w-4 h-4 text-bull" />
            ) : (
              <TrendingDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            Spread: ${spread.toFixed(2)}
          </span>
        </div>

        {/* Bids */}
        <div className="flex-1 min-h-0 flex flex-col justify-start pt-0.5 overflow-hidden">
          {displayBids.length === 0 ? (
            <div className="text-center text-muted-foreground/60 text-xs py-4">
              No bids loaded
            </div>
          ) : (
            displayBids.map((lvl, i) => (
              <Level
                key={`bid-${priceKey(lvl.price)}-${i}`}
                lvl={lvl}
                side="bid"
                max={displayMaxTotalVolume}
                onClick={() => onPriceClick(lvl.price)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
