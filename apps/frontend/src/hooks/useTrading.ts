"use client";

import { useState, useCallback } from "react";
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

export function useTrading(
  token: string | null,
  selectedMarket: string,
  handleApiAuthError: (err: unknown) => boolean,
  signout: () => void,
) {
  const [balance, setBalance] = useState<Balance>({ available: 0, locked: 0 });
  const [positions, setPositions] = useState<Position[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [onrampLoading, setOnrampLoading] = useState(false);

  const clearMessages = () => {
    setError(null);
    setInfoMessage(null);
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
        setOpenOrders(
          data.orders.flatMap((order): OpenOrder[] => {
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
          }),
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
        await apiRequest(API_ROUTES.order, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          body: JSON.stringify({ market: selectedMarket, qty, leverage, price, side, ordertype: orderType }),
        });
        setInfoMessage(`Successfully placed ${side} ${orderType} order!`);
        onSuccess();
      } catch (err) {
        if (!handleApiAuthError(err)) setError(getApiErrorMessage(err, "Failed to place order."));
      } finally {
        setOrderLoading(false);
      }
    },
    [handleApiAuthError, selectedMarket, signout, token],
  );

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
        await apiRequest(API_ROUTES.order, {
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
        setInfoMessage(`Position closed.`);
        onSuccess();
      } catch (err) {
        if (!handleApiAuthError(err)) setError(getApiErrorMessage(err, "Failed to close position."));
      } finally {
        setOrderLoading(false);
      }
    },
    [handleApiAuthError, selectedMarket, signout, token],
  );

  const cancelOrder = useCallback(
    async (orderId: string, onSuccess: () => void) => {
      clearMessages();
      if (!token) { signout(); return; }
      try {
        await apiRequest(API_ROUTES.cancel, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          body: JSON.stringify({ market: selectedMarket, orderId }),
        });
        setInfoMessage("Order cancelled successfully.");
        onSuccess();
      } catch (err) {
        if (!handleApiAuthError(err)) setError(getApiErrorMessage(err, "Failed to cancel order."));
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
        setInfoMessage(`Successfully deposited $${amount} demo funds!`);
        onSuccess();
      } catch (err) {
        if (!handleApiAuthError(err)) setError(getApiErrorMessage(err, "Onramp failed."));
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
    fills,
    error,
    closePosition,
    infoMessage,
    orderLoading,
    onrampLoading,
    fetchUserData,
    placeOrder,
    cancelOrder,
    onramp,
    clearMessages,
  };
}
