export type Side = "LONG" | "SHORT";
export type OrderType = "Limit" | "Market";
export type WsStatus = "connected" | "disconnected" | "connecting";

export interface OrderBookLevel {
  price: number;
  qty: number;
  total: number;
}

export interface OpenOrder {
  id: string;
  qty: number;
  filledQty: number;
  price: number;
  side: Side;
  market: string;
}

export interface Position {
  market: string;
  liquidationPrice: number;
  type: Side;
  qty: number;
  margin: number;
  averagePrice: number;
  leverage: number;
}

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Balance {
  available: number;
  locked: number;
}

// Backend response shapes
export type BackendOrder = {
  id?: string;
  orderId?: string;
  qty?: number | string;
  filledQty?: number | string;
  filledqty?: number | string;
  price?: number | string;
  side?: Side | "bid" | "ask";
  market?: string;
};

export type BalanceResponse = {
  success: boolean;
  balance?: { available?: number; locked?: number };
};

export type OrdersResponse = {
  success: boolean;
  orders?: BackendOrder[];
};

export type PositionResponse = {
  success: boolean;
  position?: Partial<Position>;
};

export type DepthResponse = {
  success: boolean;
  bids?: unknown;
  asks?: unknown;
  markPrice?: number;
  lastTradedPrice?: number;
};

export type StatsResponse = {
  success: boolean;
  high24h?: number | null;
  low24h?: number | null;
  volume24h?: number;
  change24h?: number;
};

export interface Fill {
  id: string;
  price: string;
  qty: string;
  role: "maker" | "taker";
  createdAt: string;
}

export type FillsResponse = {
  success: boolean;
  fills?: {
    id: string;
    price: string;
    qty: string;
    role: "maker" | "taker";
    createdAt: string;
  }[];
};

export const SUPPORTED_MARKETS = ["SOL_USDC", "BTC_USDC", "ETH_USDC"] as const;
