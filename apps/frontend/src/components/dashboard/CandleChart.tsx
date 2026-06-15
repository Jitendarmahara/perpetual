"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "../../types/trading";
import type { LastTrade } from "../../hooks/useMarketData";

type Timeframe = "1m" | "5m" | "15m" | "1H" | "2H" | "4H" | "1D";

const INTERVAL_SEC: Record<Timeframe, number> = {
  "1m":  60,
  "5m":  300,
  "15m": 900,
  "1H":  3_600,
  "2H":  7_200,
  "4H":  14_400,
  "1D":  86_400,
};

const SEED_COUNT = 80;

const MARKET_BASE: Record<string, number> = {
  BTC_USDC: 96420,
  ETH_USDC: 3120,
  SOL_USDC: 22.45,
};

function buildSeedCandles(basePrice: number, intervalSec: number): Candle[] {
  const now = Math.floor(Date.now() / 1000);
  const alignedNow = Math.floor(now / intervalSec) * intervalSec;
  const dp = basePrice >= 1000 ? 2 : basePrice >= 10 ? 3 : 4;
  let price = basePrice * (0.994 + Math.random() * 0.012);
  const out: Candle[] = [];

  for (let i = SEED_COUNT - 1; i >= 0; i--) {
    const time = alignedNow - i * intervalSec;
    const vol = price * (0.0006 + Math.random() * 0.0008);
    const open = price;
    const close = price + (Math.random() - 0.49) * vol;
    const high = Math.max(open, close) + Math.random() * vol * 0.4;
    const low = Math.min(open, close) - Math.random() * vol * 0.4;
    price = close;
    out.push({
      time,
      open: Number(open.toFixed(dp)),
      high: Number(high.toFixed(dp)),
      low: Number(low.toFixed(dp)),
      close: Number(close.toFixed(dp)),
      volume: Math.floor(80 + Math.random() * 600),
    });
  }
  return out;
}

interface CandleChartProps {
  market: string;
  lastTradedPrice: number;
  lastTrade: LastTrade | null;
}

export function CandleChart({ market, lastTradedPrice, lastTrade }: CandleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const candlesRef   = useRef<Candle[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#0b0e11" },
        textColor: "#848e9c",
        fontSize: 11,
        fontFamily: "var(--font-mono), 'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
      },
      grid: {
        vertLines: { color: "#131b25", style: 1 },
        horzLines: { color: "#131b25", style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#24303f", labelBackgroundColor: "#141a22" },
        horzLine: { color: "#24303f", labelBackgroundColor: "#141a22" },
      },
      rightPriceScale: { borderColor: "#1a2535", textColor: "#848e9c" },
      timeScale: {
        borderColor: "#1a2535",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        minBarSpacing: 2,
        shiftVisibleRangeOnNewBar: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addCandlestickSeries({
      upColor:         "#02c076",
      downColor:       "#f84960",
      borderUpColor:   "#02c076",
      borderDownColor: "#f84960",
      wickUpColor:     "#02c076",
      wickDownColor:   "#f84960",
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
    };
  }, []);

  // Re-seed on market or timeframe change
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    const base    = lastTradedPrice || MARKET_BASE[market] || 100;
    const candles = buildSeedCandles(base, INTERVAL_SEC[timeframe]);
    candlesRef.current = candles;

    const data: CandlestickData[] = candles.map((c) => ({
      time:  c.time as UTCTimestamp,
      open:  c.open,
      high:  c.high,
      low:   c.low,
      close: c.close,
    }));

    seriesRef.current.setData(data);

    const len = candles.length;
    chartRef.current.timeScale().setVisibleLogicalRange({
      from: Math.max(0, len - 60),
      to:   len + 6,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, timeframe]);

  // Live tick update
  useEffect(() => {
    if (!lastTrade || !seriesRef.current || candlesRef.current.length === 0) return;

    const intervalSec = INTERVAL_SEC[timeframe];
    const period      = Math.floor(lastTrade.ts / 1000 / intervalSec) * intervalSec;
    const candles     = candlesRef.current;
    const last        = candles[candles.length - 1];

    let next: Candle;
    if (period > last.time) {
      next = {
        time:   period,
        open:   last.close,
        high:   lastTrade.price,
        low:    lastTrade.price,
        close:  lastTrade.price,
        volume: lastTrade.qty,
      };
      candlesRef.current = [...candles, next];
    } else {
      next = {
        ...last,
        close:  lastTrade.price,
        high:   Math.max(last.high,  lastTrade.price),
        low:    Math.min(last.low,   lastTrade.price),
        volume: last.volume + lastTrade.qty,
      };
      candlesRef.current = [...candles.slice(0, -1), next];
    }

    seriesRef.current.update({
      time:  next.time as UTCTimestamp,
      open:  next.open,
      high:  next.high,
      low:   next.low,
      close: next.close,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastTrade]);

  const TF_GROUPS: Timeframe[][] = [["1m", "5m", "15m"], ["1H", "2H", "4H", "1D"]];

  return (
    <div className="flex-1 bg-[#0b0e11] flex flex-col border-b border-border relative min-h-[300px]">
      {/* Toolbar */}
      <div className="h-10 border-b border-border/60 flex items-center gap-3 px-4 shrink-0 bg-surface/30">
        <span className="text-xs font-semibold text-[#f5f6f7] tracking-wide">
          {market.replace("_", "-")}
        </span>
        <span className="text-xs font-mono text-muted-foreground">
          {lastTradedPrice.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
          })}
        </span>

        <div className="flex items-center gap-1 ml-2">
          {TF_GROUPS.map((group, gi) => (
            <div key={gi} className="flex items-center gap-0.5">
              {gi > 0 && <span className="w-px h-3 bg-border mx-1" />}
              {group.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold cursor-pointer transition-colors ${
                    timeframe === tf
                      ? "bg-lime/10 text-lime border border-lime/20"
                      : "text-muted-foreground hover:text-[#f5f6f7] hover:bg-surface-2"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Chart canvas */}
      <div ref={containerRef} className="flex-1" style={{ minHeight: "260px" }} />
    </div>
  );
}
