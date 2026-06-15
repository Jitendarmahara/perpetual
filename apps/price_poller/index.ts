import { WebSocket } from "ws";
const markt = ["SOL_USDC", "BTC_USDC", "ETH_USDC"];
import { createClient, Type } from "@repo/redis_data";
const client = await createClient();
let globalId = 1;
// store the price over her and after every 30 millesecond push it to the redis stream;
const prices: Record<string, number> = {};

async function PricePoller() {
  const ws = new WebSocket("wss://ws.backpack.exchange/");
  ws.on("open", () => {
    markt.forEach((x) => {
      ws.send(
        JSON.stringify({
          method: "SUBSCRIBE",
          params: [`trade.${x}`],
          id: globalId++,
        }),
      );

      console.log(`connected to ${x} this market`);
    });
  });
  // this pushse to the redis queue;
  ws.on("message", (data) => {
    const parse_data = JSON.parse(data.toString());
    if (!parse_data.data) {
      console.log(parse_data);
      return;
    }
    const market = parse_data.data.s;
    const price = parse_data.data.p;
    if (market && price) {
      prices[market] = parseFloat(price);
    }
    console.log(market);
    console.log(parse_data);
    console.log(prices);
  });

  ws.on("close", () => {
    setTimeout(PricePoller, 5000);
  });

  ws.on("error", (e) => {
    console.log("error while connecting to the exxhange", e);
  });
}
PricePoller();
PushPrices();
// push this to redis stream after 30 ms
let pushingPrices = false;
function PushPrices() {
  setInterval(async () => {
    if (pushingPrices || Object.keys(prices).length === 0) {
      return;
    }
    pushingPrices = true;
    try {
      for (const [key, value] of Object.entries(prices)) {
        await client.xAdd("input_stream", "*", {
          data: JSON.stringify({
            type: Type.PRICE,
            market: key,
            price: value,
          }),
        });
      }
    } catch (error) {
      console.error("error while publishing prices", error);
    } finally {
      pushingPrices = false;
    }
  }, 30);
}
