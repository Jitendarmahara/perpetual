// this file store the user websocket;

import type { RawData, WebSocket } from "ws";
import { SubscriptionManager } from "./SubscriptionManager";
import type { IncommingMessage } from "./types/types";

export class User {
  private id: string;
  private ws: WebSocket;
  constructor(id: string, ws: WebSocket) {
    this.id = id;
    this.ws = ws;
    this.addlistner(); // when the user is initialized first this should aslo start listing;
  }

  public addlistner() {
    this.ws.on("message", (data: RawData) => {
      let parsed_message: IncommingMessage;
      try {
        parsed_message = JSON.parse(data.toString());
      } catch {
        this.ws.close(1003, "Invalid JSON message");
        return;
      }

      if (parsed_message.methode === "SUBSCRIBE") {
        parsed_message.param.forEach((x) =>
          SubscriptionManager.getInstance().subscribe(this.id, x),
        );
      }
      if (parsed_message.methode === "UNSUBSCRIBE") {
        parsed_message.param.forEach((x) =>
          SubscriptionManager.getInstance().unsubscribe(this.id, x),
        );
      }
    });
    this.ws.on("error", (error) => {
      console.error(`WebSocket error for user ${this.id}:`, error);
    });
  }
  public emit(message: string) {
    this.ws.send(message);
  }
}
