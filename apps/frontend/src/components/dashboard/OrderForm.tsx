"use client";

import { useState } from "react";
import type { Balance, OrderType, Side } from "../../types/trading";

interface OrderFormProps {
  market: string;
  lastTradedPrice: number;
  balance: Balance;
  error: string | null;
  infoMessage: string | null;
  orderLoading: boolean;
  onPlaceOrder: (
    side: Side,
    orderType: OrderType,
    qty: number,
    price: number | null,
    leverage: number,
  ) => void;
}

export function OrderForm({
  market,
  lastTradedPrice,
  balance,
  error,
  infoMessage,
  orderLoading,
  onPlaceOrder,
}: OrderFormProps) {
  const [orderSide, setOrderSide] = useState<Side>("LONG");
  const [orderType, setOrderType] = useState<OrderType>("Limit");
  const [leverage, setLeverage] = useState(5);
  const [priceInput, setPriceInput] = useState(lastTradedPrice.toString());
  const [qtyInput, setQtyInput] = useState("10");

  const baseAsset = market.split("_")[0] ?? market;
  const limitPrice = orderType === "Limit" ? Number(priceInput) : null;
  const currentPrice =
    orderType === "Market" ? lastTradedPrice : Number(priceInput) || lastTradedPrice;
  const orderValue = currentPrice * (Number(qtyInput) || 0);
  const marginRequired = orderValue / leverage;

  const handleSubmit = () => {
    const qty = Number(qtyInput);
    if (!qty || qty <= 0) return;
    if (orderType === "Limit" && (!limitPrice || limitPrice <= 0)) return;
    onPlaceOrder(orderSide, orderType, qty, limitPrice, leverage);
  };

  const applyPct = (pct: number) => {
    const p = orderType === "Limit" ? Number(priceInput) : lastTradedPrice;
    if (p > 0) {
      const maxQty = (balance.available * leverage * (pct / 100)) / p;
      setQtyInput(Number(maxQty.toFixed(1)).toString());
    }
  };

  const isLong = orderSide === "LONG";

  return (
    <div className="bg-surface/20 border-t border-border p-4 flex flex-col shrink-0">
      {/* Buy / Sell tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-[#0b0e11] rounded-xl border border-border/60">
        {(["LONG", "SHORT"] as Side[]).map((s) => (
          <button
            key={s}
            onClick={() => setOrderSide(s)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${
              orderSide === s
                ? s === "LONG"
                  ? "bg-bull/20 text-bull"
                  : "bg-bear/20 text-bear"
                : "text-muted-foreground hover:text-[#f5f6f7]"
            }`}
          >
            {s === "LONG" ? "Buy / Long" : "Sell / Short"}
          </button>
        ))}
      </div>

      {/* Order type */}
      <div className="flex gap-1 mb-4 text-xs">
        {(["Limit", "Market"] as OrderType[]).map((t) => (
          <button
            key={t}
            onClick={() => setOrderType(t)}
            className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-all ${
              orderType === t
                ? "bg-surface-2 text-[#f5f6f7]"
                : "text-muted-foreground hover:text-[#f5f6f7]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-3 p-3 bg-bear/10 border border-bear/20 rounded-xl text-xs text-bear animate-fadeIn">
          ⚠️ {error}
        </div>
      )}
      {infoMessage && (
        <div className="mb-3 p-3 bg-bull/10 border border-bull/20 rounded-xl text-xs text-bull animate-fadeIn">
          ✅ {infoMessage}
        </div>
      )}

      <div className="space-y-3 text-xs mb-4">
        {/* Price input (Limit only) */}
        {orderType === "Limit" && (
          <div>
            <label className="block text-muted-foreground font-medium mb-1.5">
              Price (USDC)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                className="w-full bg-input border border-border focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20 rounded-xl py-2.5 px-3 font-mono text-[#f5f6f7] text-sm transition"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground text-[11px]">
                USDC
              </span>
            </div>
          </div>
        )}

        {/* Quantity input */}
        <div>
          <label className="block text-muted-foreground font-medium mb-1.5">
            Quantity
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={qtyInput}
              onChange={(e) => setQtyInput(e.target.value)}
              className="w-full bg-input border border-border focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20 rounded-xl py-2.5 px-3 font-mono text-[#f5f6f7] text-sm transition"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground text-[11px]">
              {baseAsset}
            </span>
          </div>
        </div>

        {/* Leverage slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-muted-foreground font-medium">Leverage</label>
            <span className="font-mono font-bold text-lime bg-lime/10 px-2 py-0.5 rounded-md text-xs">
              {leverage}x
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="20"
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-lime bg-surface-2"
          />
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1.5">
            {["1x", "5x", "10x", "15x", "20x"].map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Quick % buttons */}
      <div className="grid grid-cols-4 gap-1.5 mb-4 text-[10px] font-mono">
        {[25, 50, 75, 100].map((pct) => (
          <button
            key={pct}
            onClick={() => applyPct(pct)}
            className="bg-surface/60 hover:bg-surface-2 border border-border text-muted-foreground hover:text-[#f5f6f7] py-1 rounded-lg cursor-pointer transition-colors font-semibold"
          >
            {pct}%
          </button>
        ))}
      </div>

      {/* Order summary */}
      <div className="glass rounded-xl p-3 text-xs space-y-1.5 mb-4 font-mono">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Order value</span>
          <span className="text-[#f5f6f7]">${orderValue.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span className="text-muted-foreground">Margin required</span>
          <span className="text-[#f5f6f7]">${marginRequired.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Available balance</span>
          <span className="text-[#f5f6f7]">${balance.available.toFixed(2)}</span>
        </div>
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={orderLoading || balance.available <= 0}
        className={`w-full py-3 font-bold rounded-xl text-white cursor-pointer transition-transform active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50 text-sm ${
          isLong
            ? "bg-bull hover:opacity-90 shadow-lg shadow-bull/20"
            : "bg-bear hover:opacity-90 shadow-lg shadow-bear/20"
        }`}
      >
        {orderLoading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          `${isLong ? "Buy / Long" : "Sell / Short"} ${baseAsset}`
        )}
      </button>
    </div>
  );
}
