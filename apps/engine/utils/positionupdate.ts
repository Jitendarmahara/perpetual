import { Balance, Position } from "../stor/echangestore";
import type { positions } from "../types/types";
import { CalculateAveragePrice, LiqudationPrice } from "./matchorder";

export function CheckPositionUpdates(
  userId: string,
  market: string,
  type: "LONG" | "SHORT",
  price: number,
  qty: number,
  leverage: number,
) {
  let userposition = Position.get(userId);
  const balance = Balance.get(userId);
  if (!balance) {
    return {
      success: false,
      error: "balance not found",
    };
  }
  if (!userposition) {
    userposition = new Map();
    Position.set(userId, userposition);
  }
  const existingposition = userposition.get(market);
  if (!existingposition) {
    // then we create a new position;
    const margin = (price * qty) / leverage;
    const liquidationPrice = LiqudationPrice(leverage, qty, price, type);
    const averagePrice = price;
    const positions: positions = {
      margin,
      liquidationPrice,
      averagePrice,
      market,
      qty,
      type,
      leverage,
    };
    //set this positon
    userposition.set(market, positions);
    return {
      success: true,
    };
  } else if (existingposition && existingposition.type === type) {
    // update the quantity and averageprice etc...
    let newqty = existingposition.qty + qty;
    let avgprice = CalculateAveragePrice(
      qty,
      price,
      existingposition.averagePrice,
      existingposition.qty,
    );
    let extramargin = (qty * price) / leverage;
    const newmargin = existingposition.margin + extramargin;
    const position: positions = {
      qty: newqty,
      averagePrice: avgprice,
      market,
      margin: newmargin,
      liquidationPrice: LiqudationPrice(leverage, newqty, avgprice, type),
      type,
      leverage,
    };
    userposition.set(market, position);
    return {
      success: true,
    };
  } else if (
    existingposition &&
    existingposition.type !== type &&
    qty < existingposition.qty
  ) {
    // here we have close the positon and also update the user balances
    const relasemargin = (qty / existingposition.qty) * existingposition.margin;
    const pnl =
      existingposition.type === "LONG"
        ? (price - existingposition.averagePrice) * qty
        : (existingposition.averagePrice - price) * qty;
    existingposition.qty -= qty; // so here i am reducing the qty i think that is fine// but the nice is with the decimal precissin i have to fix that
    existingposition.margin -= relasemargin;
    existingposition.liquidationPrice = LiqudationPrice(
      existingposition.leverage ?? leverage,
      existingposition.qty,
      existingposition.averagePrice,
      existingposition.type,
    );
    balance.locked = Math.max(0, balance.locked - relasemargin);
    balance.available = Math.max(0, balance.available + relasemargin + pnl);
    return {
      success: true,
    };
  } else if (qty === existingposition.qty) {
    const pnl =
      existingposition.type === "LONG"
        ? (price - existingposition.averagePrice) * qty
        : (existingposition.averagePrice - price) * qty;
    balance.locked = Math.max(0, balance.locked - existingposition.margin);
    balance.available = Math.max(0, balance.available + existingposition.margin + pnl);
    userposition.delete(market);
    return {
      success: true,
    };
  } else if (qty > existingposition.qty && existingposition.type !== type) {
    const realizedpnl =
      existingposition.type === "LONG"
        ? (price - existingposition.averagePrice) * existingposition.qty
        : (existingposition.averagePrice - price) * existingposition.qty;
    const extraqty = qty - existingposition.qty;
    const margin = (extraqty * price) / leverage;
    if (balance.available + realizedpnl + existingposition.margin < margin) {
      return {
        success: false,
        error: "insufficient funds",
      };
    }
    balance.locked = Math.max(0, balance.locked - existingposition.margin);
    balance.available += realizedpnl + existingposition.margin;
    const position: positions = {
      margin,
      liquidationPrice: LiqudationPrice(leverage, extraqty, price, type),
      averagePrice: price,
      market,
      qty: extraqty,
      type,
      leverage,
    };
    userposition.set(market, position);
    return {
      success: true,
    };
  }
  return {
    success: true,
  };
}

export function OpenPositions(userId: string, market: string) {
  const userposition = Position.get(userId);
  if (!userposition) {
    return {
      success: false,
      error: "userposition not found",
    };
  }
  const allopenposition = userposition.get(market);
  if (!allopenposition) {
    return {
      success: false,
      error: "no open position found",
    };
  }
  return {
    success: true,
    position: allopenposition,
  };
}
