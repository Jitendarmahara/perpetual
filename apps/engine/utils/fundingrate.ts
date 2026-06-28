import { Orderbook, Position } from "../stor/echangestore";
import type { positions } from "../types/types";

function UpdateLiquidationPrice(position: positions) {
  if (position.type === "LONG") {
    position.liquidationPrice =
      position.averagePrice - position.margin / position.qty;
  } else {
    position.liquidationPrice =
      position.averagePrice + position.margin / position.qty;
  }
}
export function CalculateFundingRate() {
  for (const [userId, userposition] of Position) {
    for (const [market, userorder] of userposition) {
      const orderbook = Orderbook.get(market);
      if (!orderbook) {
        continue;
      }
      const fundingrate =
        (orderbook.lastTradedPrice - orderbook.indexprice) /
        orderbook.indexprice;
      const notionalValue = userorder.qty * orderbook.lastTradedPrice; // this is current positon of this user;
      if (userorder.type === "LONG") {
        userorder.margin = userorder.margin - notionalValue * fundingrate;
      } else {
        userorder.margin = userorder.margin + notionalValue * fundingrate;
      }
      UpdateLiquidationPrice(userorder);
    }
  }
}

