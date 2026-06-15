import { createClient, getRedisUrl } from "@repo/redis_data";
import { UserManager } from "./userManager";

type RedisClient = Awaited<ReturnType<typeof createClient>>;

export class SubscriptionManager {
  private static instance: SubscriptionManager;
  private subscription: Map<string, string[]> = new Map(); // this is from user to room subscriptin;
  private reversesubscription: Map<string, string[]> = new Map(); // this is from subscriptin_room to all the other user;
  private redisClient: Promise<RedisClient>;

  constructor() {
    this.redisClient = createClient().catch((error) => {
      console.error(
        `Subscription Redis client failed to connect at ${getRedisUrl()}:`,
        error,
      );
      throw error;
    });
  }
  // this insure only a single class can be initialized;
  public static getInstance() {
    if (!this.instance) {
      this.instance = new SubscriptionManager();
    }
    return this.instance;
  }

  public subscribe(userId: string, subscription: string) {
    // check if user allready exits there or not ;
    const subs = this.subscription.get(userId);
    if (subs) {
      if (!subs.includes(subscription)) {
        subs.push(subscription);
      }
    }
    // if not the first also subscribe to the rediscline so
    else {
      this.subscription.set(userId, [subscription]);
    }

    const reverseSubs = this.reversesubscription.get(subscription);
    if (reverseSubs) {
      if (!reverseSubs.includes(userId)) {
        reverseSubs.push(userId);
      }
    } else {
      this.reversesubscription.set(subscription, [userId]);
    }
    if (this.reversesubscription.get(subscription)?.length === 1) {
      void this.withRedis((client) =>
        client.subscribe(subscription, this.redisCallback),
      ); // if its a noraml function i do have to use the bind fucntion;
    }
  }
  // this travrse over each usersubscribe to that room and send them the message;
  private redisCallback = (message: string, channel: string) => {
    this.reversesubscription
      .get(channel)
      ?.forEach((x) => UserManager.getInstance().emit(x, message));
  };
  public unsubscribe(userId: string, subscription: string) {
    const subs = this.subscription.get(userId);
    if (!subs) {
      return;
    }
    this.subscription.set(
      userId,
      subs.filter((x) => x !== subscription),
    );
    const revsubs = this.reversesubscription.get(subscription);
    if (!revsubs) {
      return;
    }
    this.reversesubscription.set(
      subscription,
      revsubs.filter((x) => x !== userId),
    );
    if (this.reversesubscription.get(subscription)?.length === 0) {
      this.reversesubscription.delete(subscription);
      void this.withRedis((client) => client.unsubscribe(subscription));
    }
  }

  public userleft(userId: string) {
    console.log("hi user left");
    this.subscription.get(userId)?.forEach((x) => this.unsubscribe(userId, x));
  }

  private async withRedis(action: (client: RedisClient) => Promise<unknown>) {
    try {
      await action(await this.redisClient);
    } catch (error) {
      console.error("Redis subscription operation failed:", error);
    }
  }
}
