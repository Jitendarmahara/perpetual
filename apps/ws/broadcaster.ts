import { createClient, getRedisUrl, Type } from "@repo/redis_data";
import { wsMessagesSentTotal } from "./metrics";

async function startBroadcaster() {
  const redisClient = await createClient();

  console.log("Stream Broadcaster started...");

  let lastId = "$";

  while (true) {
    try {
      const response = (await redisClient.xRead(
        [{ key: "events_stream", id: lastId }],
        { BLOCK: 500, COUNT: 100 },
      )) as any;

      if (!response) continue;

      for (const stream of response) {
        for (const msg of stream.messages) {
          lastId = msg.id;
          wsMessagesSentTotal.inc();
          const data = JSON.parse(msg.message.data);

          //Send fills (trades) and order updates one-by-one, and depth changes
          if (data.type === Type.FILL) {
            const marketId = data.marketId;

            if (data.fills && marketId) {
              for (const fill of data.fills) {
                await redisClient.publish(
                  `trade.${marketId}`,
                  JSON.stringify({
                    stream: `trade.${marketId}`,
                    data: {
                      e: "trade",
                      E: Date.now(),
                      T: fill.executedAt,
                      s: marketId,
                      p: fill.price,
                      q: fill.qty,
                      t: fill.maker_order_id,
                      m: true,
                    },
                  }),
                );
              }
            }

            if (data.orderUpdates && marketId) {
              for (const update of data.orderUpdates) {
                await redisClient.publish(
                  `trade.${marketId}`,
                  JSON.stringify({
                    stream: `trade.${marketId}`,
                    data: {
                      e: "orderUpdate",
                      E: Date.now(),
                      s: marketId,
                      orderId: update.orderId,
                      filledqty: update.filledqty,
                      qty: update.qty,
                      status: update.status,
                    },
                  }),
                );
              }
            }

            if (marketId && (data.bids || data.asks)) {
              await redisClient.publish(
                `depth.${marketId}`,
                JSON.stringify({
                  stream: `depth.${marketId}`,
                  data: {
                    e: "depth",
                    E: Date.now(),
                    s: marketId,
                    b: data.bids || [],
                    a: data.asks || [],
                  },
                }),
              );
            }
          }

          if (data.type === Type.PRICE) {
            const marketId = data.market as string;
            const price = data.price as number;
            if (marketId && price) {
              await redisClient.publish(
                `ticker.${marketId}`,
                JSON.stringify({
                  stream: `ticker.${marketId}`,
                  data: {
                    e: "ticker",
                    E: Date.now(),
                    s: marketId,
                    p: price,
                  },
                }),
              );
            }
          }

          if (data.type === Type.CREATE_ORDER) {
            const order = data.order;
            if (order) {
              const marketId = order.marketId;
              await redisClient.publish(
                `trade.${marketId}`,
                JSON.stringify({
                  stream: `trade.${marketId}`,
                  data: {
                    e: "orderPlace",
                    E: Date.now(),
                    s: marketId,
                    order: {
                      id: order.id,
                      userId: order.userId,
                      side: order.side,
                      price: order.price,
                      qty: order.qty,
                      status: order.status,
                    },
                  },
                }),
              );
            }
          }

          if (data.type === Type.CANCLE_ORDER && data.success) {
            const marketId = data.market as string;
            if (marketId && (data.bids || data.asks)) {
              await redisClient.publish(
                `depth.${marketId}`,
                JSON.stringify({
                  stream: `depth.${marketId}`,
                  data: {
                    e: "depth",
                    E: Date.now(),
                    s: marketId,
                    b: data.bids || [],
                    a: data.asks || [],
                  },
                }),
              );
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in broadcaster loop:", error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

startBroadcaster().catch((error) => {
  console.error(
    `Stream Broadcaster failed to start with Redis at ${getRedisUrl()}:`,
    error,
  );
});
