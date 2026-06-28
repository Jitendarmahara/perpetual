"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle, CandlesResponse } from "../../types/trading";
import type { LastTrade } from "../../hooks/useMarketData";
import { apiRequest } from "../../api";
import { API_ROUTES } from "../../config";

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
  const seededRef    = useRef(false);
  // Buffer holds WS ticks that arrive before history is fetched
  const bufferRef        = useRef<LastTrade[]>([]);
  const historyLoadedRef = useRef(false);
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

  // Shared tick processor — used for both live updates and buffer replay
  const processTick = useCallback((price: number, qty: number, ts: number, intervalSec: number) => {
    if (!seriesRef.current || candlesRef.current.length === 0) return;

    const period  = Math.floor(ts / 1000 / intervalSec) * intervalSec;
    const candles = candlesRef.current;
    const last    = candles[candles.length - 1]!;

    let next: Candle;
    if (period > last.time) {
      next = {
        time:   period,
        open:   last.close,
        high:   price,
        low:    price,
        close:  price,
        volume: qty,
      };
      candlesRef.current = [...candles, next];
    } else {
      next = {
        ...last,
        close:  price,
        high:   Math.max(last.high, price),
        low:    Math.min(last.low,  price),
        volume: last.volume + qty,
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
  }, []);

  // On market/timeframe change:
  // 1. Clear chart and reset state — WS is already live and ticks will start buffering
  // 2. Fetch historical candles from the DB
  // 3. Render history, then replay only the buffered ticks newer than history
  // This guarantees zero gap between history and live data
  useEffect(() => {
    if (!seriesRef.current) return;

    candlesRef.current     = [];
    seededRef.current      = false;
    bufferRef.current      = [];
    historyLoadedRef.current = false;
    seriesRef.current.setData([]);

    let cancelled = false;
    const intervalSec = INTERVAL_SEC[timeframe];

    apiRequest<CandlesResponse>(API_ROUTES.candles(market, timeframe))
      .then((data) => {
        if (cancelled || !seriesRef.current) return;

        const candles: Candle[] = data.candles ?? [];

        if (candles.length > 0) {
          seriesRef.current.setData(
            candles.map((c) => ({
              time:  c.time as UTCTimestamp,
              open:  c.open,
              high:  c.high,
              low:   c.low,
              close: c.close,
            })),
          );
          candlesRef.current = candles;
          seededRef.current  = true;
        }

        // Replay only buffered ticks that fall in periods newer than what the DB returned
        const lastHistoricalTime = candles.length > 0 ? candles[candles.length - 1]!.time : 0;
        for (const tick of bufferRef.current) {
          const period = Math.floor(tick.ts / 1000 / intervalSec) * intervalSec;
          if (period <= lastHistoricalTime) continue;
          processTick(tick.price, tick.qty, tick.ts, intervalSec);
        }
      })
      .catch(() => {
        // History unavailable — seed fallback will trigger from lastTradedPrice
      })
      .finally(() => {
        if (!cancelled) {
          historyLoadedRef.current = true;
          bufferRef.current = [];
        }
      });

    return () => { cancelled = true; };
  }, [market, timeframe, processTick]);

  // Seed exactly one real data point as soon as we know the real current
  // price, so the chart isn't blank — everything after this is built from
  // actual trade ticks, nothing is fabricated.
  useEffect(() => {
    if (!seriesRef.current || seededRef.current || lastTradedPrice <= 0) return;
    seededRef.current = true;

    const intervalSec = INTERVAL_SEC[timeframe];
    const time = Math.floor(Date.now() / 1000 / intervalSec) * intervalSec;
    const candle: Candle = {
      time,
      open: lastTradedPrice,
      high: lastTradedPrice,
      low: lastTradedPrice,
      close: lastTradedPrice,
      volume: 0,
    };
    candlesRef.current = [candle];
    seriesRef.current.setData([{
      time: time as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }]);
  }, [lastTradedPrice, timeframe]);

  // Live tick update — buffers ticks until history is loaded, then applies them in real time
  useEffect(() => {
    if (!lastTrade || !seriesRef.current) return;

    if (!historyLoadedRef.current) {
      bufferRef.current.push(lastTrade);
      return;
    }

    if (candlesRef.current.length === 0) return;
    processTick(lastTrade.price, lastTrade.qty, lastTrade.ts, INTERVAL_SEC[timeframe]);
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
          {lastTradedPrice > 0
            ? lastTradedPrice.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })
            : "—"}
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
