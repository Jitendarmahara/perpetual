// the concept of adl is that if we are not able to liqudation a user positon then i need find the best user positon in opposite side and liqudate that user ;
import { Position, Balance } from "../stor/echangestore";
import type { positions } from "../types/types";
import { Pnl } from "./liqudation";
type ADLTarget = {
  userId: string;
  position: positions;
  priority: number; // this is for ther current pnl porift
};
export function ADL(
  market: string,
  liqudationuserId: string,
  type: "LONG" | "SHORT",
  remaningqty: number,
  price: number,
) {
  const oppositetype = type === "LONG" ? "SHORT" : "LONG";
  const candidate: ADLTarget[] = []; // array of all the profitable perosn ;
  // traverse over all the positons
  for (const [userId, postions] of Position) {
    if (userId === liqudationuserId) continue;
    const pos = postions.get(market);
    if (!pos || pos.type !== oppositetype) {
      continue;
    }
    const pnl = Pnl(pos, price);
    const pnlPercentage = (pnl / (pos.averagePrice * pos.qty)) * 100;
    const priority = pnlPercentage * pos.leverage;

    candidate.push({ userId, position: pos, priority });
  }
  candidate.sort((a, b) => b.priority - a.priority);
  let executedqty = 0;
  for (const target of candidate) {
    if (executedqty >= remaningqty) {
      break;
    }
    const balance = Balance.get(target.userId);
    if (!balance) {
      return {
        success: false,
        error: "Balance not found for the user",
      };
    }
    const minfilled = Math.min(target.position.qty, remaningqty - executedqty);
    executedqty += minfilled;
    const realsedmargin =
      (minfilled / target.position.qty) * target.position.margin; // this margin will be reduce from the opposite person in orderbook;
    const realizedpnl =
      Pnl(target.position, price) * (minfilled / target.position.qty);
    // updating the target user detis;
    target.position.qty -= minfilled;
    target.position.margin -= realsedmargin;
    // update the balnce of the target user
    balance.locked -= realsedmargin;
    balance.available += realsedmargin + realizedpnl;
    // what if all the qty of this users are filled completely;
    if (target.position.qty === 0) {
      Position.get(target.userId)?.delete(market);
    }
  }
  const liqudationuserbalnce = Balance.get(liqudationuserId);
  if (!liqudationuserbalnce) {
    return {
      success: false,
      error: "user balnce not found",
    };
  }

  // updat the postion of the liqudationuser;
  const liqudationuserposition = Position.get(liqudationuserId);
  if (!liqudationuserposition) {
    return {
      success: false,
      error: "user positon not found",
    };
  }
  if (executedqty < remaningqty) {
    return {
      success: false,
      error: "Insurance fund will take care of this loss",
    };
  }
  const liquser = liqudationuserposition.get(market);
  if (liquser) {
    liqudationuserbalnce.locked = Math.max(
      0,
      liqudationuserbalnce.locked - liquser.margin,
    );
  }
  liqudationuserposition.delete(market);

  return {
    success: true,
    executedqty,
  };
}
