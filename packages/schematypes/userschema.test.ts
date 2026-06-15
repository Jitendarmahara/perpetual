import { describe, expect, test } from "bun:test";
import {
  OnrampSchema,
  OrderSchema,
  SigninSchema,
  SignupSchema,
} from "./userschema";

describe("user auth schemas", () => {
  test("SignupSchema accepts required email and password with optional name", () => {
    expect(
      SignupSchema.safeParse({
        email: "user@example.com",
        password: "secret",
        name: "User",
      }).success,
    ).toBe(true);
  });

  test("SigninSchema rejects missing credentials", () => {
    expect(SigninSchema.safeParse({ email: "user@example.com" }).success).toBe(
      false,
    );
    expect(SigninSchema.safeParse({ password: "secret" }).success).toBe(false);
  });
});

describe("OnrampSchema", () => {
  test("coerces numeric strings to positive finite amounts", () => {
    const result = OnrampSchema.safeParse({ amount: "25.5" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(25.5);
    }
  });

  test.each([
    { amount: 0 },
    { amount: -1 },
    { amount: "0" },
    { amount: "not-a-number" },
    { amount: Infinity },
  ])("rejects invalid amount %#", (input) => {
    expect(OnrampSchema.safeParse(input).success).toBe(false);
  });
});

describe("OrderSchema", () => {
  test("accepts market orders without price and coerces numeric fields", () => {
    const result = OrderSchema.safeParse({
      market: "BTC_USDC",
      qty: "2.5",
      leverage: "10",
      side: "LONG",
      ordertype: "Market",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        market: "BTC_USDC",
        qty: 2.5,
        leverage: 10,
        side: "LONG",
        ordertype: "Market",
      });
      expect(result.data.price).toBeUndefined();
    }
  });

  test("requires positive price for limit orders", () => {
    expect(
      OrderSchema.safeParse({
        market: "BTC_USDC",
        qty: 1,
        leverage: 10,
        side: "LONG",
        ordertype: "Limit",
      }).success,
    ).toBe(false);

    expect(
      OrderSchema.safeParse({
        market: "BTC_USDC",
        qty: 1,
        leverage: 10,
        price: 100,
        side: "LONG",
        ordertype: "Limit",
      }).success,
    ).toBe(true);
  });

  test.each([
    { field: "market", value: "" },
    { field: "qty", value: 0 },
    { field: "qty", value: -1 },
    { field: "qty", value: "not-a-number" },
    { field: "leverage", value: 0 },
    { field: "leverage", value: -1 },
    { field: "price", value: 0 },
    { field: "price", value: -1 },
    { field: "side", value: "BUY" },
    { field: "ordertype", value: "Stop" },
  ])("rejects invalid $field", ({ field, value }) => {
    const baseOrder = {
      market: "BTC_USDC",
      qty: 1,
      leverage: 10,
      price: 100,
      side: "LONG",
      ordertype: "Limit",
    };

    expect(
      OrderSchema.safeParse({ ...baseOrder, [field]: value }).success,
    ).toBe(false);
  });
});
