import { z } from "zod";
export const SignupSchema = z.object({
  email: z.string(),
  password: z.string(),
  name: z.string().optional(),
});

export const SigninSchema = z.object({
  email: z.string(),
  password: z.string(),
});

export const OnrampSchema = z.object({
  amount: z.coerce.number().finite().positive(),
});

export const OrderSchema = z
  .object({
    market: z.string().min(1),
    qty: z.coerce.number().finite().positive(),
    leverage: z.coerce.number().finite().positive(),
    price: z.coerce.number().finite().positive().nullable().optional(),
    side: z.enum(["LONG", "SHORT"]),
    ordertype: z.enum(["Limit", "Market"]),
  })
  .superRefine((order, ctx) => {
    if (order.ordertype === "Limit" && order.price == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price"],
        message: "Price is required for limit orders",
      });
    }
  });
