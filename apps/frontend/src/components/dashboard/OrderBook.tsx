"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import type { OrderBookLevel } from "../../types/trading";

interface OrderBookProps {
  market: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  maxTotalVolume: number;
  lastTradedPrice: number;
  marketError: string | null;
  onPriceClick: (price: number) => void;
}

function Level({
  lvl,
  side,
  max,
  onClick,
}: {
  lvl: OrderBookLevel;
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
      className="relative grid grid-cols-3 px-4 py-[3px] font-mono text-xs hover:bg-surface-2/60 transition cursor-pointer"
    >
      <div
        className="absolute right-0 top-0 h-full pointer-events-none"
        style={{ width: `${pct}%`, background: depthBg }}
      />
      <span className={`relative font-semibold ${priceClass}`}>
        ${lvl.price.toFixed(2)}
      </span>
      <span className="relative text-right text-[#f5f6f7]">{lvl.qty.toFixed(2)}</span>
      <span className="relative text-right text-muted-foreground text-[10px]">
        {lvl.total.toFixed(2)}
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
  onPriceClick,
}: OrderBookProps) {
  const spread = Math.max(
    0,
    (asks[asks.length - 1]?.price ?? 0) - (bids[0]?.price ?? 0),
  );

  return (
    <div className="flex-1 flex flex-col border-b border-border min-h-[300px]">
      {/* Header */}
      <div className="h-10 border-b border-border bg-surface/40 flex items-center justify-between px-4 shrink-0">
        <span className="text-xs font-semibold text-[#f5f6f7] uppercase tracking-wider">
          Order Book
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">
          {market.replace("_", "-")}
        </span>
      </div>

      {/* Column labels */}
      <div className="grid grid-cols-3 px-4 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/50 bg-surface/20">
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
        <div className="flex-1 flex flex-col justify-end min-h-[120px] pb-0.5">
          {asks.length === 0 ? (
            <div className="text-center text-muted-foreground/60 text-xs py-4">
              No asks loaded
            </div>
          ) : (
            asks.map((lvl, i) => (
              <Level
                key={i}
                lvl={lvl}
                side="ask"
                max={maxTotalVolume}
                onClick={() => onPriceClick(lvl.price)}
              />
            ))
          )}
        </div>

        {/* Spread / last price row */}
        <div className="px-4 py-2.5 border-y border-border bg-surface/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-lg font-bold text-[#f5f6f7]">
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
        <div className="flex-1 flex flex-col justify-start min-h-[120px] pt-0.5">
          {bids.length === 0 ? (
            <div className="text-center text-muted-foreground/60 text-xs py-4">
              No bids loaded
            </div>
          ) : (
            bids.map((lvl, i) => (
              <Level
                key={i}
                lvl={lvl}
                side="bid"
                max={maxTotalVolume}
                onClick={() => onPriceClick(lvl.price)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
