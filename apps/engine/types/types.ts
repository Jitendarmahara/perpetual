export type positions = {
  market: string;
  liquidationPrice: number;
  type: "LONG" | "SHORT";
  qty: number; // this represnt the minium number of qty filled
  margin: number;
  averagePrice: number;
  leverage: number;
};
export type collateral = {
  available: number;
  locked: number;
};
export type openOrders = {
  userId: string;
  qty: number;
  filledQty: number;
  orderId: string;
  createdAt: Date;
  leverage: number;
  marginLocked?: number;
};
export type Bid = {
  availableQty: number;
  openOrders: openOrders[];
};

export type Orderbooks = {
  bids: Map<number, Bid>;
  asks: Map<number, Bid>;
  lastTradedPrice: number;
  indexprice: number;
};

/*
export type Order = {
    orderId:number,
    status: 'filled' | "open" | 'cancelled' | 'partially_filled',
    market : string,
    type: 'LONG' | 'SHORT',
    qty:number,
    orderType : "limit" | "market"
    price: number,
    margin : number,
    userId:number,
    filledqty: number
}
*/

// Optimized memory tracking configurations at 2026-06-08 23:56:59
