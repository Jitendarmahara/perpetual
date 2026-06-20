import { Position } from "../stor/echangestore";
import type { positions } from "../types/types";
import { CreateOrder, PublishEngineEvents } from "./matchorder";
import { ADL } from "./autodeleverage";

export function Pnl(position: positions, currentprice: number) {
  if (position.type === "LONG") {
    return (currentprice - position.averagePrice) * position.qty;
  } else {
    return (position.averagePrice - currentprice) * position.qty;
  }
}

export async function LiquidatePosition(
  price: number,
  market: string,
  position: positions,
  userId: string,
) {
  if (position.type === "LONG" && price <= position.liquidationPrice) {
    const result = CreateOrder(
      userId,
      position.qty,
      position.leverage,
      null,
      "SHORT",
      market,
      "Market",
    );
    if (result.success) {
      const remainingPosition = Position.get(userId)?.get(market);
      if (remainingPosition) {
        const adlResult = ADL(
          market,
          userId,
          position.type,
          remainingPosition.qty,
          price,
        );
        if (!adlResult.success) {
          // insurance fund
        }
      }
      await PublishEngineEvents(result.events);
    }
  }
  if (position.type === "SHORT" && price >= position.liquidationPrice) {
    const result = CreateOrder(
      userId,
      position.qty,
      position.leverage,
      null,
      "LONG",
      market,
      "Market",
    );
    if (result.success) {
      const remainingPosition = Position.get(userId)?.get(market); // if we the market is filled and we delte it then in that case if i use hte posito.qty
      // it night give the old value might be stored in the memory ;
      if (remainingPosition) {
        const adlResult = ADL(
          market,
          userId,
          position.type,
          remainingPosition.qty,
          price,
        );
        if (!adlResult.success) {
          // insurance fund
        }
      }
      await PublishEngineEvents(result.events);
    }
  }
}

export async function CheckForLiqudation(market: string, price: number) {
  const publishTasks: Promise<void>[] = [];
  for (const [userId, positoins] of Position) {
    const position = positoins.get(market);
    if (!position) {
      continue;
    }
    publishTasks.push(LiquidatePosition(price, market, position, userId));
  }
  await Promise.all(publishTasks);
}
