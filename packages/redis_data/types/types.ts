export type ToEngineOnRamp = {
  type: Type;
  amount: number;
  userId: string;
  loopbackid: string;
};

export type ToEngineCreateMarket = {
  type: Type.INITIALIZE_MARKET;
  market: string;
  lastTradedPrice: number;
  indexprice: number;
  loopbackid: string;
};

export type PriceData = {
  type: Type.PRICE;
  market: string;
  price: number;
};

export type FillData = {
  id: string;
  maker_id: string;
  taker_id: string;
  price: string;
  qty: string;
  maker_order_id: string;
  taker_order_id: string;
  marketId: string;
  executedAt: string;
};

export type OrderUpdate = {
  orderId: string;
  filledqty: number;
  qty: number;
  status: string;
};
export type RespnseOrder = {
  orderId: string;
};

export interface FromEngineOnRamp {
  success: boolean;
  amount: number;
  loopbackid: string;
  error?: string;
}

export enum Type {
  ON_RAMP,
  CREATE_ORDER,
  INITIALIZE_BALANCE,
  CANCLE_ORDER,
  GET_ORDER,
  GET_BALANCE,
  INITIALIZE_MARKET,
  PRICE,
  FILL,
  UPDATE_ORDER,
  GET_DEPTH,
  GET_POSITION,
}
