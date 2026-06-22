"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Wallet, PlusCircle, LogOut, TrendingUp, TrendingDown } from "lucide-react";
import type { WsStatus } from "../../types/trading";
import { SUPPORTED_MARKETS } from "../../types/trading";

interface HeaderProps {
  selectedMarket: string;
  onMarketChange: (market: string) => void;
  markPrice: number;
  priceChange24h: number;
  priceHigh24h: number;
  priceLow24h: number;
  volume24h: number;
  balance: { available: number; locked: number };
  wsStatus: WsStatus;
  userEmail: string | null;
  onDepositClick: () => void;
  onSignout: () => void;
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "lime" | "bull" | "bear";
}) {
  const c =
    tone === "lime"
      ? "text-lime"
      : tone === "bull"
        ? "text-bull"
        : tone === "bear"
          ? "text-bear"
          : "text-[#f5f6f7]";
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`font-mono font-semibold ${c}`}>{value}</span>
    </div>
  );
}

export function Header({
  selectedMarket,
  onMarketChange,
  markPrice,
  priceChange24h,
  priceHigh24h,
  priceLow24h,
  volume24h,
  balance,
  wsStatus,
  userEmail,
  onDepositClick,
  onSignout,
}: HeaderProps) {
  const changePositive = priceChange24h >= 0;
  const [marketMenuOpen, setMarketMenuOpen] = useState(false);
  const marketMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!marketMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (marketMenuRef.current && !marketMenuRef.current.contains(e.target as Node)) {
        setMarketMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [marketMenuOpen]);

  return (
    <header className="relative z-30 h-16 border-b border-border bg-surface/60 backdrop-blur-md flex items-center px-6 shrink-0 gap-5">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-lime to-bull flex items-center justify-center glow-lime">
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 text-[#0b0e11]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 7h7v7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="font-display font-bold text-[15px] tracking-tight hidden sm:inline">
          BACKPACK<span className="text-lime font-mono text-sm">FUTURES</span>
        </span>
      </Link>

      <div className="w-px h-6 bg-border shrink-0" />

      {/* Market selector */}
      <div className="relative shrink-0" ref={marketMenuRef}>
        <button
          onClick={() => setMarketMenuOpen((open) => !open)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass hover:bg-surface-2 transition cursor-pointer"
        >
          <span className="font-mono font-bold text-sm">{selectedMarket.replace("_", "-")}</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
        {marketMenuOpen && (
          <div className="absolute top-10 left-0 w-44 bg-[#141a22] border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
            {SUPPORTED_MARKETS.map((m) => (
              <button
                key={m}
                onClick={() => {
                  onMarketChange(m);
                  setMarketMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 text-sm font-mono hover:bg-surface-2 hover:text-lime transition cursor-pointer"
              >
                {m.replace("_", "-")}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Market stats */}
      <div className="hidden md:flex items-center gap-6 text-xs flex-1">
        <Stat
          label="Mark"
          value={`$${markPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          tone="lime"
        />
        <Stat
          label="24h Δ"
          value={`${changePositive ? "+" : ""}${priceChange24h}%`}
          tone={changePositive ? "bull" : "bear"}
        />
        <Stat
          label="24h High"
          value={`$${priceHigh24h.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
        />
        <Stat
          label="24h Low"
          value={`$${priceLow24h.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
        />
        <Stat
          label="Volume"
          value={`$${volume24h.toLocaleString('en-US')}`}
        />
        <div className="ml-2 hidden lg:flex items-center gap-1.5 text-[#848e9c]">
          {changePositive ? (
            <TrendingUp className="w-3.5 h-3.5 text-bull" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-bear" />
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 ml-auto shrink-0">
        {/* WS status */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={`w-2 h-2 rounded-full ${
              wsStatus === "connected"
                ? "bg-bull animate-pulse-dot"
                : wsStatus === "connecting"
                  ? "bg-amber-400"
                  : "bg-bear"
            }`}
          />
          {wsStatus === "connected" ? "Live" : wsStatus}
        </div>

        {/* Balance */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs glass px-3 py-1.5 rounded-xl">
          <Wallet className="w-3.5 h-3.5 text-lime" />
          <span className="text-muted-foreground">Balance:</span>
          <span className="font-mono font-bold">
            $
            {balance.available.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        {/* Deposit */}
        <button
          onClick={onDepositClick}
          className="bg-lime hover:opacity-90 text-[#0b0e11] font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-transform active:scale-95 glow-lime cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Deposit
        </button>

        <div className="w-px h-5 bg-border" />

        {/* User */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-lime to-bull shrink-0" />
          <span className="hidden lg:inline font-mono text-xs text-muted-foreground max-w-[120px] truncate">
            {userEmail}
          </span>
          <button
            onClick={onSignout}
            title="Logout"
            className="text-muted-foreground hover:text-bear transition p-1 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
