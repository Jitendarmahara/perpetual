import type { collateral, Orderbooks, positions } from "../types/types";
export const Orderbook: Map<string, Orderbooks> = new Map();
export const Balance: Map<string, collateral> = new Map();
export const Position: Map<string, Map<string, positions>> = new Map();
