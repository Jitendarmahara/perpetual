"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  PriceScaleMode,
  type AutoscaleInfoProvider,
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

const VISIBLE_BARS: Record<Timeframe, number> = {
  "1m":  72,
  "5m":  72,
  "15m": 72,
  "1H":  80,
  "2H":  80,
  "4H":  84,
  "1D":  90,
};
const RIGHT_PADDING_BARS = 10;
const PRICE_SCALE_OPTIONS = {
  autoScale: true,
  mode: PriceScaleMode.Normal,
  alignLabels: true,
  scaleMargins: {
    top: 0.12,
    bottom: 0.12,
  },
};
const paddedAutoscaleInfo: AutoscaleInfoProvider = (original) => {
  const autoscale = original();
  if (!autoscale) return autoscale;

  const { minValue, maxValue } = autoscale.priceRange;
  const range = Math.max(maxValue - minValue, Math.abs(maxValue) * 0.001, 0.01);
  return {
    priceRange: {
      minValue: minValue - range * 0.08,
      maxValue: maxValue + range * 0.08,
    },
    margins: {
      above: 18,
      below: 18,
    },
  };
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
  const lastTickTsByPeriodRef = useRef<Map<number, number>>(new Map());
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
      rightPriceScale: {
        ...PRICE_SCALE_OPTIONS,
        borderColor: "#1a2535",
        textColor: "#848e9c",
      },
      timeScale: {
        borderColor: "#1a2535",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: RIGHT_PADDING_BARS,
        barSpacing: 9,
        minBarSpacing: 5,
        shiftVisibleRangeOnNewBar: true,
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
      autoscaleInfoProvider: paddedAutoscaleInfo,
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    let priceScaleFrame: number | null = null;
    const resetPriceAutoscale = () => {
      priceScaleFrame = null;
      chart.priceScale("right").applyOptions(PRICE_SCALE_OPTIONS);
      series.priceScale().applyOptions(PRICE_SCALE_OPTIONS);
    };
    const requestPriceAutoscale = () => {
      if (priceScaleFrame !== null) window.cancelAnimationFrame(priceScaleFrame);
      priceScaleFrame = window.requestAnimationFrame(resetPriceAutoscale);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(requestPriceAutoscale);
    requestPriceAutoscale();

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(requestPriceAutoscale);
      if (priceScaleFrame !== null) window.cancelAnimationFrame(priceScaleFrame);
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
    };
  }, []);

  const focusLatestCandles = useCallback((count: number) => {
    if (!chartRef.current || count <= 0) return;

    const visibleBars = VISIBLE_BARS[timeframe];
    const rightPadding = Math.min(RIGHT_PADDING_BARS, Math.floor(visibleBars / 5));
    const occupiedBars = visibleBars - rightPadding;
    const from =
      count >= occupiedBars
        ? count - occupiedBars
        : -Math.max(0, occupiedBars - count) / 2;

    const timeScale = chartRef.current.timeScale();
    timeScale.applyOptions({
      rightOffset: rightPadding,
      barSpacing: 9,
      minBarSpacing: 5,
    });
    timeScale.setVisibleLogicalRange({
      from,
      to: from + visibleBars,
    });
  }, [timeframe]);

  const renderCandles = useCallback((candles: Candle[], focus = false) => {
    if (!seriesRef.current) return;

    seriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    if (focus) {
      window.requestAnimationFrame(() => focusLatestCandles(candles.length));
    }
  }, [focusLatestCandles]);

  // Shared tick processor — used for both live updates and buffer replay.
  // Ticks can arrive out of order after a refresh, so update by candle period
  // instead of blindly mutating the newest candle.
  const processTick = useCallback((price: number, qty: number, ts: number, intervalSec: number) => {
    if (
      !seriesRef.current ||
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isFinite(ts)
    ) {
      return;
    }

    const period  = Math.floor(ts / 1000 / intervalSec) * intervalSec;
    const candles = candlesRef.current;
    const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 0;

    if (candles.length === 0) {
      const first: Candle = {
        time: period,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: safeQty,
      };
      candlesRef.current = [first];
      seededRef.current = true;
      lastTickTsByPeriodRef.current.set(period, ts);
      seriesRef.current.setData([{
        time: period as UTCTimestamp,
        open: price,
        high: price,
        low: price,
        close: price,
      }]);
      window.requestAnimationFrame(() => focusLatestCandles(1));
      return;
    }

    const last = candles[candles.length - 1]!;
    const existingIndex = candles.findIndex((c) => c.time === period);

    if (period > last.time) {
      const next = {
        time:   period,
        open:   price,
        high:   price,
        low:    price,
        close:  price,
        volume: safeQty,
      };
      candlesRef.current = [...candles, next];
      lastTickTsByPeriodRef.current.set(period, ts);
      seriesRef.current.update({
        time:  next.time as UTCTimestamp,
        open:  next.open,
        high:  next.high,
        low:   next.low,
        close: next.close,
      });
      return;
    }

    if (existingIndex === -1) {
      if (period < candles[0]!.time) return;

      const previous = [...candles]
        .reverse()
        .find((c) => c.time < period);
      const inserted: Candle = {
        time: period,
        open: previous?.close ?? price,
        high: price,
        low: price,
        close: price,
        volume: safeQty,
      };
      const nextCandles = [...candles, inserted].sort((a, b) => a.time - b.time);
      candlesRef.current = nextCandles;
      lastTickTsByPeriodRef.current.set(period, ts);
      renderCandles(nextCandles);
      return;
    }

    const current = candles[existingIndex]!;
    const previousTs = lastTickTsByPeriodRef.current.get(period) ?? -Infinity;
    const next: Candle = {
      ...current,
      close: ts >= previousTs ? price : current.close,
      high: Math.max(current.high, price),
      low: Math.min(current.low, price),
      volume: current.volume + safeQty,
    };
    const nextCandles = [...candles];
    nextCandles[existingIndex] = next;
    candlesRef.current = nextCandles;
    lastTickTsByPeriodRef.current.set(period, Math.max(previousTs, ts));

    if (existingIndex === candles.length - 1) {
      seriesRef.current.update({
        time:  next.time as UTCTimestamp,
        open:  next.open,
        high:  next.high,
        low:   next.low,
        close: next.close,
      });
    } else {
      renderCandles(nextCandles);
    }
  }, [focusLatestCandles, renderCandles]);

  // On market/timeframe change:
  // 1. Clear chart and reset state — WS is already live and ticks will start buffering
  // 2. Fetch historical candles from the DB
  // 3. Render history, then replay only the buffered ticks newer than history
  // This guarantees zero gap between history and live data
  useEffect(() => {
    if (!seriesRef.current) return;

    candlesRef.current     = [];
    seededRef.current      = false;
    lastTickTsByPeriodRef.current.clear();
    bufferRef.current      = [];
    historyLoadedRef.current = false;
    seriesRef.current.setData([]);

    let cancelled = false;
    const intervalSec = INTERVAL_SEC[timeframe];

    apiRequest<CandlesResponse>(API_ROUTES.candles(market, timeframe))
      .then((data) => {
        if (cancelled || !seriesRef.current) return;

        const candles: Candle[] = (data.candles ?? [])
          .filter((c) =>
            Number.isFinite(c.time) &&
            Number.isFinite(c.open) &&
            Number.isFinite(c.high) &&
            Number.isFinite(c.low) &&
            Number.isFinite(c.close),
          )
          .sort((a, b) => a.time - b.time);

        if (candles.length > 0) {
          renderCandles(candles);
          candlesRef.current = candles;
          seededRef.current  = true;
        }

        // Replay buffered websocket ticks for the current/newer periods only.
        // Older historical periods are already covered by the DB response.
        const lastHistoricalTime = candles.length > 0 ? candles[candles.length - 1]!.time : 0;
        const bufferedTicks = [...bufferRef.current].sort((a, b) => a.ts - b.ts);
        for (const tick of bufferedTicks) {
          const period = Math.floor(tick.ts / 1000 / intervalSec) * intervalSec;
          if (period < lastHistoricalTime) continue;
          processTick(tick.price, tick.qty, tick.ts, intervalSec);
        }

        focusLatestCandles(candlesRef.current.length);
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
  }, [market, timeframe, focusLatestCandles, processTick, renderCandles]);

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
    lastTickTsByPeriodRef.current.set(time, Date.now());
    seriesRef.current.setData([{
      time: time as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }]);
    window.requestAnimationFrame(() => focusLatestCandles(1));
  }, [focusLatestCandles, lastTradedPrice, timeframe]);

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
    <div className="flex-1 min-h-0 bg-[#0b0e11] flex flex-col border-b border-border relative">
      {/* Toolbar */}
      <div className="h-9 border-b border-border/60 flex items-center gap-3 px-4 shrink-0 bg-surface/30">
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
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
