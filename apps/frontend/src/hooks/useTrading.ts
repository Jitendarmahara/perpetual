"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { ApiError, apiRequest, authHeaders, getApiErrorMessage } from "../api";
import { API_ROUTES } from "../config";
import { toNumber, normalizeOrderSide } from "../utils/trading";
import type {
  Balance,
  BalanceResponse,
  Fill,
  FillsResponse,
  OpenOrder,
  OrdersResponse,
  Position,
  PositionResponse,
  Side,
  OrderType,
} from "../types/trading";

// Engine returns two distinct "no position" messages:
// "userposition not found"  — user has never had a fill (Position map not created yet)
// "no open position found"  — user has traded but no open position for this market
const isMissingPositionError = (err: unknown) =>
  err instanceof ApiError &&
  typeof err.message === "string" &&
  (err.message.toLowerCase().includes("no open position") ||
    err.message.toLowerCase().includes("userposition not found"));

const isMissingOrderbookError = (err: unknown) =>
  err instanceof ApiError &&
  typeof err.message === "string" &&
  err.message.toLowerCase().includes("orderbook not found");

type CreateOrderResponse = {
  success?: boolean;
  executedqty?: number | string;
  remaningqty?: number | string;
  remainingQty?: number | string;
};

const ORDER_HIGHLIGHT_TTL_MS = 15_000;

const orderLevelKey = (order: OpenOrder) =>
  `${order.market}:${order.side}:${order.price.toFixed(8)}`;

export function useTrading(
  token: string | null,
  selectedMarket: string,
  handleApiAuthError: (err: unknown) => boolean,
  signout: () => void,
) {
  const [balance, setBalance] = useState<Balance>({ available: 0, locked: 0 });
  const [positions, setPositions] = useState<Position[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [pendingOrderHighlights, setPendingOrderHighlights] = useState<OpenOrder[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [onrampLoading, setOnrampLoading] = useState(false);

  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHighlightTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => {
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    for (const timeout of pendingHighlightTimeoutsRef.current) clearTimeout(timeout);
  }, []);

  const clearMessages = () => {
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    setError(null);
    setInfoMessage(null);
  };

  // Every banner (success or error) auto-dismisses after a few seconds
  // instead of sitting on screen until the next action clears it.
  const MESSAGE_TTL_MS = 5000;
  const showInfo = (msg: string) => {
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    setError(null);
    setInfoMessage(msg);
    messageTimeoutRef.current = setTimeout(() => setInfoMessage(null), MESSAGE_TTL_MS);
  };
  const showError = (msg: string) => {
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    setInfoMessage(null);
    setError(msg);
    messageTimeoutRef.current = setTimeout(() => setError(null), MESSAGE_TTL_MS);
  };

  const fetchUserData = useCallback(async () => {
    const tok = token || localStorage.getItem("token");
    if (!tok) return;

    // Balance
    try {
      const data = await apiRequest<BalanceResponse>(API_ROUTES.balance, {
        headers: authHeaders(tok),
      });
      if (data.balance) {
        setBalance({
          available: toNumber(data.balance.available),
          locked: toNumber(data.balance.locked),
        });
      }
    } catch (err) {
      if (handleApiAuthError(err)) return;
      console.error("Error fetching balance", err);
    }

    // Open orders
    try {
      const data = await apiRequest<OrdersResponse>(API_ROUTES.orders(selectedMarket), {
        headers: authHeaders(tok),
      });
      if (Array.isArray(data.orders)) {
        const nextOrders = data.orders.flatMap((order): OpenOrder[] => {
          const id = order.orderId || order.id;
          if (!id) return [];
          return [{
            id,
            qty: toNumber(order.qty),
            filledQty: toNumber(order.filledQty ?? order.filledqty),
            price: toNumber(order.price),
            side: normalizeOrderSide(order.side),
            market: order.market || selectedMarket,
          }];
        });
        setOpenOrders(nextOrders);
        const realOrderKeys = new Set(nextOrders.map(orderLevelKey));
        setPendingOrderHighlights((pending) =>
          pending.filter((order) => !realOrderKeys.has(orderLevelKey(order))),
        );
      } else {
        setOpenOrders([]);
      }
    } catch (err) {
      if (handleApiAuthError(err)) return;
      if (isMissingOrderbookError(err)) setOpenOrders([]);
      else console.error("Error fetching open orders", err);
    }

    // Position
    try {
      const data = await apiRequest<PositionResponse>(API_ROUTES.position(selectedMarket), {
        headers: authHeaders(tok),
      });
      if (data.position) {
        const p = data.position;
        const qty = toNumber(p.qty);
        const single: Position = {
          market: p.market || selectedMarket,
          liquidationPrice: toNumber(p.liquidationPrice),
          type: p.type === "SHORT" ? "SHORT" : "LONG",
          qty,
          margin: toNumber(p.margin),
          averagePrice: toNumber(p.averagePrice),
          leverage: toNumber(p.leverage, 1),
        };
        setPositions(qty > 0 ? [single] : []);
      } else {
        setPositions([]);
      }
    } catch (err) {
      if (handleApiAuthError(err)) return;
      if (isMissingPositionError(err)) setPositions([]);
      else console.error("Error fetching position", err);
    }

    // Fills
    try {
      const data = await apiRequest<FillsResponse>(API_ROUTES.fills(selectedMarket), {
        headers: authHeaders(tok),
      });
      if (Array.isArray(data.fills)) {
        setFills(data.fills.map((f) => ({
          id: f.id,
          price: f.price,
          qty: f.qty,
          role: f.role,
          createdAt: f.createdAt,
        })));
      }
    } catch {
      // fills endpoint may not have data yet; silently ignore
    }
  }, [handleApiAuthError, selectedMarket, token]);

  const placeOrder = useCallback(
    async (
      side: Side,
      orderType: OrderType,
      qty: number,
      price: number | null,
      leverage: number,
      onSuccess: () => void,
    ) => {
      clearMessages();
      if (!token) { signout(); return; }
      setOrderLoading(true);
      try {
        const result = await apiRequest<CreateOrderResponse>(API_ROUTES.order, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          body: JSON.stringify({ market: selectedMarket, qty, leverage, price, side, ordertype: orderType }),
        });
        const remainingQty = toNumber(result.remaningqty ?? result.remainingQty);
        if (orderType === "Limit" && price && remainingQty > 0) {
          const pendingOrder: OpenOrder = {
            id: `pending-${Date.now()}`,
            qty: remainingQty,
            filledQty: 0,
            price,
            side,
            market: selectedMarket,
          };
          const pendingKey = orderLevelKey(pendingOrder);
          setPendingOrderHighlights((pending) => [
            ...pending.filter((order) => orderLevelKey(order) !== pendingKey),
            pendingOrder,
          ]);
          const timeout = setTimeout(() => {
            setPendingOrderHighlights((pending) =>
              pending.filter((order) => order.id !== pendingOrder.id),
            );
          }, ORDER_HIGHLIGHT_TTL_MS);
          pendingHighlightTimeoutsRef.current.push(timeout);
        }
        showInfo(`Successfully placed ${side} ${orderType} order!`);
        onSuccess();
      } catch (err) {
        if (!handleApiAuthError(err)) showError(getApiErrorMessage(err, "Failed to place order."));
      } finally {
        setOrderLoading(false);
      }
    },
    [handleApiAuthError, selectedMarket, signout, token],
  );

  const orderBookOrders = useMemo(() => {
    const realOrderKeys = new Set(openOrders.map(orderLevelKey));
    return [
      ...openOrders,
      ...pendingOrderHighlights.filter((order) => !realOrderKeys.has(orderLevelKey(order))),
    ];
  }, [openOrders, pendingOrderHighlights]);

  const closePosition = useCallback(
    async (
      side: Side,
      qty: number,
      leverage: number,
      onSuccess: () => void,
    ) => {
      clearMessages();
      if (!token) { signout(); return; }
      setOrderLoading(true);
      try {
        const result = await apiRequest<{ executedqty?: number }>(API_ROUTES.order, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          body: JSON.stringify({
            market: selectedMarket,
            qty,
            leverage,
            price: null,
            side,
            ordertype: "Market",
          }),
        });
        // For Market orders the engine's own remaningqty is measured against
        // available liquidity, not our original request, so it's always 0
        // even on a partial fill — compare executedqty against what we asked
        // for instead.
        const executed = result.executedqty ?? 0;
        const shortfall = qty - executed;
        showInfo(
          shortfall > 1e-9
            ? `Position partially closed — ${shortfall} still open (not enough resting liquidity to fill the rest).`
            : "Position closed.",
        );
        onSuccess();
      } catch (err) {
        if (!handleApiAuthError(err)) showError(getApiErrorMessage(err, "Failed to close position."));
      } finally {
        setOrderLoading(false);
      }
    },
    [handleApiAuthError, selectedMarket, signout, token],
  );

  const [cancelLoading, setCancelLoading] = useState(false);
  const cancelOrder = useCallback(
    async (orderId: string, onSuccess: () => void) => {
      clearMessages();
      if (!token) { signout(); return; }
      setCancelLoading(true);
      try {
        await apiRequest(API_ROUTES.cancel, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          body: JSON.stringify({ market: selectedMarket, orderId }),
        });
        showInfo("Order cancelled successfully.");
        onSuccess();
      } catch (err) {
        if (!handleApiAuthError(err)) showError(getApiErrorMessage(err, "Failed to cancel order."));
      } finally {
        setCancelLoading(false);
      }
    },
    [handleApiAuthError, selectedMarket, signout, token],
  );

  const onramp = useCallback(
    async (amount: number, onSuccess: () => void) => {
      clearMessages();
      if (!token) { signout(); return; }
      setOnrampLoading(true);
      try {
        await apiRequest(API_ROUTES.onramp, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          body: JSON.stringify({ amount }),
        });
        showInfo(`Successfully deposited $${amount} demo funds!`);
        onSuccess();
      } catch (err) {
        if (!handleApiAuthError(err)) showError(getApiErrorMessage(err, "Onramp failed."));
      } finally {
        setOnrampLoading(false);
      }
    },
    [handleApiAuthError, signout, token],
  );

  return {
    balance,
    positions,
    openOrders,
    orderBookOrders,
    fills,
    error,
    closePosition,
    infoMessage,
    orderLoading,
    cancelLoading,
    onrampLoading,
    fetchUserData,
    placeOrder,
    cancelOrder,
    onramp,
    clearMessages,
  };
}
