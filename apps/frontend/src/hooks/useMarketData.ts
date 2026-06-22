"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiRequest } from "../api";
import { API_ROUTES } from "../config";
import { buildOrderBookSide, mergeIncrementalDepth } from "../utils/trading";
import type { DepthResponse, OrderBookLevel, StatsResponse } from "../types/trading";

export type LastTrade = { price: number; qty: number; ts: number };

export function useMarketData(selectedMarket: string) {
  const [bids, setBids] = useState<OrderBookLevel[]>([]);
  const [asks, setAsks] = useState<OrderBookLevel[]>([]);
  const [maxTotalVolume, setMaxTotalVolume] = useState(1);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [lastTradedPrice, setLastTradedPrice] = useState(0);
  const [markPrice, setMarkPrice] = useState(0);
  const [priceHigh24h, setPriceHigh24h] = useState(0);
  const [priceLow24h, setPriceLow24h] = useState(0);
  const [volume24h, setVolume24h] = useState(0);
  const [priceChange24h, setPriceChange24h] = useState(0);
  const [lastTrade, setLastTrade] = useState<LastTrade | null>(null);
  const bidsRef = useRef<OrderBookLevel[]>([]);
  const asksRef = useRef<OrderBookLevel[]>([]);

  const commitDepth = useCallback((nextBids: OrderBookLevel[], nextAsks: OrderBookLevel[]) => {
    bidsRef.current = nextBids;
    asksRef.current = nextAsks;
    setBids(nextBids);
    setAsks(nextAsks);

    const maxVol = Math.max(
      nextAsks.reduce((acc, l) => Math.max(acc, l.total), 0),
      nextBids.reduce((acc, l) => Math.max(acc, l.total), 0),
      1,
    );
    setMaxTotalVolume(maxVol);
  }, []);

  // Clear stale stats from the previous market while the real fetch is in flight
  useEffect(() => {
    setLastTradedPrice(0);
    setMarkPrice(0);
    setPriceHigh24h(0);
    setPriceLow24h(0);
    setVolume24h(0);
    setPriceChange24h(0);
  }, [selectedMarket]);

  const applyDepth = useCallback((rawBids: unknown, rawAsks: unknown) => {
    const formattedAsks = buildOrderBookSide(rawAsks, "asc");
    const formattedBids = buildOrderBookSide(rawBids, "desc");

    commitDepth(formattedBids, [...formattedAsks].reverse());
  }, [commitDepth]);

  const applyIncrementalDepth = useCallback((rawBids: unknown, rawAsks: unknown) => {
    const nextBids = mergeIncrementalDepth(bidsRef.current, rawBids, "desc");
    const nextAsksAsc = mergeIncrementalDepth(asksRef.current, rawAsks, "asc");
    commitDepth(nextBids, [...nextAsksAsc].reverse());
  }, [commitDepth]);

  const fetchDepth = useCallback(async () => {
    try {
      const data = await apiRequest<DepthResponse>(API_ROUTES.depth(selectedMarket));
      applyDepth(data.bids, data.asks);
      if (data.markPrice && data.markPrice > 0) {
        setMarkPrice(data.markPrice);
      }
      if (data.lastTradedPrice && data.lastTradedPrice > 0) {
        setLastTradedPrice(data.lastTradedPrice);
      }
      setMarketError(null);
    } catch {
      setBids([]);
      setAsks([]);
      setMarketError(`${selectedMarket.replace("_", "-")} orderbook not yet initialized in the engine.`);
    }
  }, [applyDepth, selectedMarket]);

  // Load depth on mount and on market change
  useEffect(() => {
    commitDepth([], []);
    setMarketError(null);
    fetchDepth();
  }, [commitDepth, fetchDepth]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiRequest<StatsResponse>(API_ROUTES.stats(selectedMarket));
      if (typeof data.high24h === "number") setPriceHigh24h(data.high24h);
      if (typeof data.low24h === "number") setPriceLow24h(data.low24h);
      if (typeof data.volume24h === "number") setVolume24h(data.volume24h);
      if (typeof data.change24h === "number") setPriceChange24h(data.change24h);
    } catch {
      // Stats are a nice-to-have — keep whatever was last shown on failure.
    }
  }, [selectedMarket]);

  // Pull real 24h stats on mount/market change, then keep them fresh while open.
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const applyTradeTick = useCallback((price: number, qty: number) => {
    setLastTradedPrice(price);
    setLastTrade({ price, qty, ts: Date.now() });
  }, []);

  // Updates mark price from the price poller ticker (no fill required)
  const applyTickerPrice = useCallback((price: number) => {
    setMarkPrice(price);
  }, []);

  return {
    bids,
    asks,
    maxTotalVolume,
    marketError,
    lastTradedPrice,
    markPrice,
    priceHigh24h,
    priceLow24h,
    volume24h,
    priceChange24h,
    lastTrade,
    applyDepth,
    applyIncrementalDepth,
    applyTradeTick,
    applyTickerPrice,
    fetchDepth,
  };
}
