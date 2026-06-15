"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiRequest } from "../api";
import { API_ROUTES } from "../config";
import { buildOrderBookSide, mergeIncrementalDepth } from "../utils/trading";
import type { DepthResponse, OrderBookLevel } from "../types/trading";

function defaultPrice(market: string) {
  if (market === "BTC_USDC") return 96420;
  if (market === "ETH_USDC") return 3120;
  return 22.45;
}

export type LastTrade = { price: number; qty: number; ts: number };

export function useMarketData(selectedMarket: string) {
  const [bids, setBids] = useState<OrderBookLevel[]>([]);
  const [asks, setAsks] = useState<OrderBookLevel[]>([]);
  const [maxTotalVolume, setMaxTotalVolume] = useState(1);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [lastTradedPrice, setLastTradedPrice] = useState(() => defaultPrice(selectedMarket));
  const [markPrice, setMarkPrice] = useState(() => defaultPrice(selectedMarket));
  const [priceHigh24h, setPriceHigh24h] = useState(() => defaultPrice(selectedMarket) * 1.04);
  const [priceLow24h, setPriceLow24h] = useState(() => defaultPrice(selectedMarket) * 0.97);
  const [volume24h, setVolume24h] = useState(1420500);
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

  // Reset market stats when market changes
  useEffect(() => {
    const base = defaultPrice(selectedMarket);
    setLastTradedPrice(base);
    setMarkPrice(base);
    setPriceHigh24h(base * 1.04);
    setPriceLow24h(base * 0.97);
    setVolume24h(
      selectedMarket === "BTC_USDC" ? 82400 : selectedMarket === "ETH_USDC" ? 314000 : 1420500,
    );
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
    lastTrade,
    applyDepth,
    applyIncrementalDepth,
    applyTradeTick,
    applyTickerPrice,
    fetchDepth,
  };
}
