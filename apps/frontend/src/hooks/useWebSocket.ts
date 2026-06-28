"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { WS_BASE_URL } from "../config";
import type { WsStatus } from "../types/trading";

function parseWsTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  }

  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

interface WsHandlers {
  onDepth: (rawBids: unknown, rawAsks: unknown) => void;
  onTrade: (price: number, qty: number, ts: number) => void;
  onOrderEvent: (orderId: string) => void;
  onTicker?: (price: number) => void;
}

export function useWebSocket(
  selectedMarket: string,
  token: string | null,
  handlers: WsHandlers,
) {
  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  const marketRef = useRef(selectedMarket);
  const subscribedMarketRef = useRef<string | null>(null);
  handlersRef.current = handlers;
  marketRef.current = selectedMarket;

  const sendMarketSubscription = useCallback((
    method: "SUBSCRIBE" | "UNSUBSCRIBE",
    market: string,
  ) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        methode: method,
        param: [`depth.${market}`, `trade.${market}`, `ticker.${market}`],
      }));
    }
  }, []);

  const subscribeCurrentMarket = useCallback(() => {
    const ws = wsRef.current;
    const market = marketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    sendMarketSubscription("SUBSCRIBE", market);
    subscribedMarketRef.current = market;
  }, [sendMarketSubscription]);

  // Re-subscribe when market changes (without reconnecting)
  useEffect(() => {
    const previousMarket = subscribedMarketRef.current;
    if (previousMarket && previousMarket !== selectedMarket) {
      sendMarketSubscription("UNSUBSCRIBE", previousMarket);
      subscribedMarketRef.current = null;
    }
    subscribeCurrentMarket();
  }, [selectedMarket, sendMarketSubscription, subscribeCurrentMarket]);

  // Connect once on mount, disconnect on unmount
  useEffect(() => {
    const tok = token || localStorage.getItem("token");
    if (!tok) return;

    setWsStatus("connecting");
    const ws = new WebSocket(`${WS_BASE_URL}?token=${encodeURIComponent(tok)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("connected");
      subscribeCurrentMarket();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        const data = msg.data;
        const currentMarket = marketRef.current;

        if (msg.stream === `ticker.${currentMarket}` && data?.e === "ticker") {
          handlersRef.current.onTicker?.(Number(data.p));
        } else if (msg.stream === `depth.${currentMarket}` && data?.e === "depth") {
          handlersRef.current.onDepth(data.b ?? [], data.a ?? []);
        } else if (msg.stream === `trade.${currentMarket}` && data) {
          if (data.e === "trade") {
            const ts = parseWsTimestamp(data.T) ?? parseWsTimestamp(data.E) ?? Date.now();
            handlersRef.current.onTrade(Number(data.p), Number(data.q), ts);
            const el = document.getElementById("price-indicator");
            if (el) {
              el.classList.add(data.m ? "flash-green" : "flash-red");
              setTimeout(() => el.classList.remove("flash-green", "flash-red"), 300);
            }
          } else if (data.e === "orderUpdate") {
            handlersRef.current.onOrderEvent(data.orderId ?? "");
          } else if (data.e === "orderPlace") {
            handlersRef.current.onOrderEvent(data.order?.id ?? "");
          }
        }
      } catch (err) {
        console.error("WS parse error", err);
      }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) setWsStatus("disconnected");
    };
    ws.onerror = () => {
      if (wsRef.current === ws) setWsStatus("disconnected");
    };

    return () => {
      subscribedMarketRef.current = null;
      ws.close();
      wsRef.current = null;
    };
    // Only connect on mount/unmount; market changes handled above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return { wsStatus };
}
