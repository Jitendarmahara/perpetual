"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import type { Fill, OpenOrder, Position } from "../../types/trading";

interface PositionsPanelProps {
  positions: Position[];
  openOrders: OpenOrder[];
  fills: Fill[];
  selectedMarket: string;
  lastTradedPrice: number;
  error: string | null;
  infoMessage: string | null;
  closeLoading: boolean;
  cancelLoading: boolean;
  onCancelOrder: (orderId: string) => void;
  onClosePosition: (pos: Position) => void;
  onRefresh: () => void;
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground gap-1.5 py-6">
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5 text-muted-foreground/30"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </div>
  );
}

export function PositionsPanel({
  positions,
  openOrders,
  fills,
  selectedMarket,
  lastTradedPrice,
  error,
  infoMessage,
  closeLoading,
  cancelLoading,
  onCancelOrder,
  onClosePosition,
  onRefresh,
}: PositionsPanelProps) {
  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "fills">("positions");

  const tabs = [
    { id: "positions" as const, label: `Positions (${positions.length})` },
    { id: "orders" as const, label: `Open Orders (${openOrders.length})` },
    { id: "fills" as const, label: `Fills (${fills.length})` },
  ];

  return (
    <div className="h-44 xl:h-48 bg-surface/10 flex flex-col shrink-0">
      {/* Tab bar */}
      <div className="h-9 border-b border-border bg-surface/40 flex items-center justify-between px-4 shrink-0">
        <div className="flex gap-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-xs font-semibold tracking-wide py-2 border-b-2 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "border-lime text-lime"
                  : "border-transparent text-muted-foreground hover:text-[#f5f6f7]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={onRefresh}
          title="Refresh"
          className="text-muted-foreground hover:text-lime cursor-pointer transition-colors p-1 rounded"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-2 p-2 bg-bear/10 border border-bear/20 rounded-lg text-xs text-bear animate-fadeIn shrink-0">
          ⚠️ {error}
        </div>
      )}
      {infoMessage && (
        <div className="mx-4 mt-2 p-2 bg-bull/10 border border-bull/20 rounded-lg text-xs text-bull animate-fadeIn shrink-0">
          ✅ {infoMessage}
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-[#0b0e11]/30">
        {/* Positions tab */}
        {activeTab === "positions" &&
          (positions.length === 0 ? (
            <EmptyState label={`No active positions for ${selectedMarket.replace("_", "-")}`} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/50">
                    <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider">Market</th>
                    <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider">Side</th>
                    <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider">Lev</th>
                    <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider">Qty</th>
                    <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider">Margin</th>
                    <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider">Entry</th>
                    <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider">Liq</th>
                    <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider">PnL (ROE%)</th>
                    <th className="px-4 py-2 text-right font-medium text-[10px] uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos, i) => {
                    const pnl =
                      pos.type === "LONG"
                        ? (lastTradedPrice - pos.averagePrice) * pos.qty
                        : (pos.averagePrice - lastTradedPrice) * pos.qty;
                    const roe = pos.margin > 0 ? (pnl / pos.margin) * 100 : 0;
                    const pnlPos = pnl >= 0;
                    return (
                      <tr
                        key={i}
                        className="border-b border-border/20 hover:bg-surface-2/30 transition"
                      >
                        <td className="px-4 py-2.5 font-bold text-[#f5f6f7]">
                          {pos.market.replace("_", "-")}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              pos.type === "LONG"
                                ? "bg-bull/10 text-bull"
                                : "bg-bear/10 text-bear"
                            }`}
                          >
                            {pos.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[#f5f6f7]">{pos.leverage}x</td>
                        <td className="px-4 py-2.5 text-[#f5f6f7]">{pos.qty}</td>
                        <td className="px-4 py-2.5 text-[#f5f6f7]">${pos.margin.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-[#f5f6f7]">${pos.averagePrice.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-bear">${pos.liquidationPrice.toFixed(2)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`font-bold ${pnlPos ? "text-bull" : "text-bear"}`}>
                            {pnlPos ? "+" : ""}${pnl.toFixed(2)}
                          </span>
                          <span
                            className={`ml-1 text-[10px] ${pnlPos ? "text-bull/60" : "text-bear/60"}`}
                          >
                            ({pnlPos ? "+" : ""}{roe.toFixed(1)}%)
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => onClosePosition(pos)}
                            disabled={closeLoading}
                            className="text-xs bg-bear/10 hover:bg-bear text-bear hover:text-white px-2.5 py-1 rounded-lg cursor-pointer font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Close
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

        {/* Open orders tab */}
        {activeTab === "orders" &&
          (openOrders.length === 0 ? (
            <EmptyState label="No resting open orders." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/50">
                    <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider">Side</th>
                    <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider">Price</th>
                    <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider">Qty</th>
                    <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider">Filled</th>
                    <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider">Remaining</th>
                    <th className="px-4 py-2 text-right font-medium text-[10px] uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {openOrders.map((ord) => (
                    <tr
                      key={ord.id}
                      className="border-b border-purple-400/25 bg-purple-500/10 ring-1 ring-inset ring-purple-400/25 hover:bg-purple-500/15 transition"
                    >
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            ord.side === "LONG"
                              ? "bg-bull/10 text-bull"
                              : "bg-bear/10 text-bear"
                          }`}
                        >
                          {ord.side}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-bold text-[#f5f6f7]">
                        ${ord.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-[#f5f6f7]">{ord.qty}</td>
                      <td className="px-4 py-2.5 text-[#f5f6f7]">{ord.filledQty}</td>
                      <td className="px-4 py-2.5 text-[#f5f6f7]">{ord.qty - ord.filledQty}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => onCancelOrder(ord.id)}
                          disabled={cancelLoading}
                          className="text-xs bg-bear/10 hover:bg-bear text-bear hover:text-white px-2.5 py-1 rounded-lg cursor-pointer font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {/* Fills tab */}
        {activeTab === "fills" &&
          (fills.length === 0 ? (
            <EmptyState label={`No trade history for ${selectedMarket.replace("_", "-")}`} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/50">
                    <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider">Role</th>
                    <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider">Price</th>
                    <th className="px-4 py-2 font-medium text-[10px] uppercase tracking-wider">Qty</th>
                    <th className="px-4 py-2 text-right font-medium text-[10px] uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {fills.map((fill) => (
                    <tr
                      key={fill.id}
                      className="border-b border-border/20 hover:bg-surface-2/30 transition"
                    >
                      <td className="px-4 py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            fill.role === "maker"
                              ? "bg-surface-2 text-muted-foreground"
                              : "bg-lime/10 text-lime"
                          }`}
                        >
                          {fill.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-bold text-[#f5f6f7]">
                        ${Number(fill.price).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-[#f5f6f7]">{fill.qty}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {new Date(fill.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </div>
  );
}
