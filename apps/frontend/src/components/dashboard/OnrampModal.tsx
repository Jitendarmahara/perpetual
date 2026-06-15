"use client";

import { useState } from "react";
import { Wallet, X } from "lucide-react";

interface OnrampModalProps {
  loading: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => void;
}

export function OnrampModal({ loading, onClose, onSubmit }: OnrampModalProps) {
  const [amount, setAmount] = useState("500");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) return;
    onSubmit(num);
  };

  const presets = [100, 500, 1000, 5000];

  return (
    <div
      className="fixed inset-0 bg-[#0b0e11]/80 backdrop-blur-md flex items-center justify-center z-[100] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass rounded-2xl p-6 w-full max-w-sm shadow-2xl relative border border-border">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-lime/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-lime" />
              </div>
              <h3 className="font-display font-bold text-base">Deposit Demo Funds</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Add sandbox collateral to simulate trades without real money.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-[#f5f6f7] cursor-pointer transition-colors p-1 rounded-lg hover:bg-surface-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount presets */}
          <div className="grid grid-cols-4 gap-2">
            {presets.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setAmount(p.toString())}
                className={`py-2 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
                  amount === p.toString()
                    ? "bg-lime/15 text-lime border border-lime/30"
                    : "bg-surface/60 border border-border text-muted-foreground hover:text-[#f5f6f7] hover:bg-surface-2"
                }`}
              >
                ${p}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Custom amount (USD / USDC)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-muted-foreground text-sm">
                $
              </span>
              <input
                type="number"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-input border border-border focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20 rounded-xl py-2.5 pl-8 pr-4 text-sm font-mono text-[#f5f6f7] transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-lime hover:opacity-90 text-[#0b0e11] font-bold text-sm py-3 rounded-xl cursor-pointer glow-lime flex items-center justify-center gap-1.5 disabled:opacity-50 transition"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-[#0b0e11]/30 border-t-[#0b0e11] rounded-full animate-spin" />
            ) : (
              "Complete Deposit"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
