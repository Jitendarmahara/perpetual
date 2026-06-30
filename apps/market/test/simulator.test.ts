import { describe, expect, test } from "bun:test";
import {
  MARKET_CONFIGS,
  buildQuoteLadder,
  priceForMarket,
  roundToTick,
  type MarketSymbol,
} from "../src/simulator";

describe("market process quote helpers", () => {
  test("roundToTick snaps prices to the configured market tick", () => {
    expect(roundToTick(145.236, 0.01)).toBe(145.24);
    expect(roundToTick(108_000.24, 0.5)).toBe(108_000);
    expect(roundToTick(3_650.076, 0.05)).toBe(3_650.1);
  });

  test("priceForMarket prefers live price over fallback price", () => {
    const config = MARKET_CONFIGS[0]!;
    const livePrices = new Map<MarketSymbol, number>([[config.name, 151.22]]);

    expect(priceForMarket(config, livePrices)).toBe(151.22);
    expect(priceForMarket(config, new Map())).toBe(config.fallbackPrice);
  });

  test("buildQuoteLadder places bids below and asks above real price", () => {
    const config = MARKET_CONFIGS[0]!;
    const { bids, asks } = buildQuoteLadder(config, 145, 5);

    expect(bids).toHaveLength(5);
    expect(asks).toHaveLength(5);
    expect(bids[0]!.price).toBeLessThan(145);
    expect(asks[0]!.price).toBeGreaterThan(145);

    for (let i = 1; i < bids.length; i++) {
      expect(bids[i]!.price).toBeLessThan(bids[i - 1]!.price);
      expect(asks[i]!.price).toBeGreaterThan(asks[i - 1]!.price);
    }
  });
});
