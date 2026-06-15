export const SUBSCRIBE = "SUBSCRIBE";
export const UNSUBSCRIBE = "UNSUBSCRIBE";
export type SubscribeMessage = {
  methode: typeof SUBSCRIBE;
  param: string[];
};

export type UnsubscribeMessage = {
  methode: typeof UNSUBSCRIBE;
  param: string[];
};

export type IncommingMessage = SubscribeMessage | UnsubscribeMessage;
