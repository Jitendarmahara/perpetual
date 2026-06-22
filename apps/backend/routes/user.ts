import { Router, type Request, type Response } from "express";
import {
  SignupSchema,
  SigninSchema,
  OnrampSchema,
  OrderSchema,
} from "@repo/schematypes";
import { Type } from "@repo/redis_data";
import { client } from "@repo/db/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Loopback } from "../loopback";
import { randomUUID } from "crypto";
import { authMiddleware, type AuthRequest } from "../middleware/auth";
const router = Router();
router.post("/signup", async (req: Request, res: Response) => {
  const data = SignupSchema.safeParse(req.body);
  if (!data.success) {
    return res.status(404).json({
      success: false,
      error: "Invalid Schema",
    });
  }
  const hashpassword = await bcrypt.hash(data.data.password, 10);
  await client.user.create({
    data: {
      username: data.data.email,
      password: hashpassword,
      role: "User",
    },
  });
  return res.status(200).json({
    success: true,
    data: "User Created Successfully",
  });
});

router.post("/signin", async (req: Request, res: Response) => {
  const data = SigninSchema.safeParse(req.body);
  if (!data.success) {
    return res.status(403).json({
      success: false,
      error: "Invalid Schema",
    });
  }
  const user = await client.user.findUnique({
    where: {
      username: data.data.email,
    },
  });
  if (!user) {
    return res.status(403).json({
      success: false,
      error: "User not found",
    });
  }
  const validpassword = await bcrypt.compare(data.data.password, user.password);
  if (!validpassword) {
    return res.status(403).json({
      success: false,
      error: "Invalid email or password",
    });
  }
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);

  const engineresponse = await Loopback({
    type: Type.INITIALIZE_BALANCE,
    userId: user.id,
    amount: 0,
    loopbackid: randomUUID(),
  });

  return res.status(200).json({
    success: true,
    token: token,
  });
});
router.post(
  "/onramp",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const data = OnrampSchema.safeParse(req.body);
    if (!data.success) {
      return res.status(403).json({
        success: false,
        error: "Invalid inputs schema",
      });
    }
    const engineresponse = await Loopback({
      type: Type.ON_RAMP,
      userId: req.userId!,
      amount: data.data.amount,
      loopbackid: randomUUID(),
    });
    return res.json(engineresponse);
  },
);

router.post(
  ["/order", "/create_order"],
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const data = OrderSchema.safeParse(req.body);
    if (!data.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid order inputs",
      });
    }

    try {
      const engineresponse = await Loopback({
        type: Type.CREATE_ORDER,
        userId: req.userId!,
        market: data.data.market,
        qty: data.data.qty,
        leverage: data.data.leverage,
        price: data.data.price ?? null,
        side: data.data.side,
        ordertype: data.data.ordertype,
        loopbackid: randomUUID(),
      });
      return res.json(engineresponse);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  },
);

const cancelHandler = async (req: AuthRequest, res: Response) => {
  const market = req.body.market || req.query.market;
  const orderId = req.body.orderId || req.query.orderId;

  if (!market || !orderId) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: market, orderId",
    });
  }

  try {
    const engineresponse = await Loopback({
      type: Type.CANCLE_ORDER,
      userId: req.userId!,
      orderId,
      market,
      loopbackid: randomUUID(),
    });
    return res.json(engineresponse);
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
};

router.delete("/order", authMiddleware, cancelHandler);
router.post("/cancel_order", authMiddleware, cancelHandler);
router.post("/cancel", authMiddleware, cancelHandler);
router.delete("/cancel", authMiddleware, cancelHandler);

const getOrdersHandler = async (req: AuthRequest, res: Response) => {
  const market = (req.query.market as string) || (req.body.market as string);
  if (!market) {
    return res.status(400).json({
      success: false,
      error: "Missing required query parameter: market",
    });
  }

  try {
    const engineresponse = await Loopback({
      type: Type.GET_ORDER,
      userId: req.userId!,
      market,
      loopbackid: randomUUID(),
    });
    return res.json(engineresponse);
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
};

router.get("/orders", authMiddleware, getOrdersHandler);
router.get("/get_orders", authMiddleware, getOrdersHandler);
router.get("/order/open", authMiddleware, getOrdersHandler);

const getBalanceHandler = async (req: AuthRequest, res: Response) => {
  try {
    const engineresponse = await Loopback({
      type: Type.GET_BALANCE,
      userId: req.userId!,
      loopbackid: randomUUID(),
    });
    return res.json(engineresponse);
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
};

router.get("/balance", authMiddleware, getBalanceHandler);
router.get("/get_balance", authMiddleware, getBalanceHandler);

const getDepthHandler = async (req: Request, res: Response) => {
  const market = (req.query.market as string) || (req.body.market as string);
  if (!market) {
    return res.status(400).json({
      success: false,
      error: "Missing required parameter: market",
    });
  }

  try {
    const engineresponse = await Loopback({
      type: Type.GET_DEPTH,
      market,
      loopbackid: randomUUID(),
    });
    return res.json(engineresponse);
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
};

router.get("/depth", getDepthHandler);
router.get("/get_depth", getDepthHandler);

const getStatsHandler = async (req: Request, res: Response) => {
  const market = (req.query.market as string) || (req.body.market as string);
  if (!market) {
    return res.status(400).json({
      success: false,
      error: "Missing required parameter: market",
    });
  }

  try {
    const marketRecord = await client.market.findUnique({ where: { market_slug: market } });
    if (!marketRecord) {
      return res.json({ success: true, high24h: null, low24h: null, volume24h: 0, change24h: 0 });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const fills = await client.fills.findMany({
      where: { marketId: marketRecord.id, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { price: true, qty: true },
    });

    if (fills.length === 0) {
      return res.json({ success: true, high24h: null, low24h: null, volume24h: 0, change24h: 0 });
    }

    const openPrice = Number(fills[0]!.price);
    const lastPrice = Number(fills[fills.length - 1]!.price);
    let high24h = -Infinity;
    let low24h = Infinity;
    let volume24h = 0;
    for (const fill of fills) {
      const price = Number(fill.price);
      const qty = Number(fill.qty);
      high24h = Math.max(high24h, price);
      low24h = Math.min(low24h, price);
      volume24h += price * qty;
    }
    const change24h = openPrice > 0 ? ((lastPrice - openPrice) / openPrice) * 100 : 0;

    return res.json({ success: true, high24h, low24h, volume24h, change24h });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
};

router.get("/stats", getStatsHandler);

const getPositionHandler = async (req: AuthRequest, res: Response) => {
  const market = (req.query.market as string) || (req.body.market as string);
  if (!market) {
    return res.status(400).json({
      success: false,
      error: "Missing required parameter: market",
    });
  }

  try {
    const engineresponse = await Loopback({
      type: Type.GET_POSITION,
      userId: req.userId!,
      market,
      loopbackid: randomUUID(),
    });
    return res.json(engineresponse);
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
};

router.get("/position", authMiddleware, getPositionHandler);
router.get("/get_position", authMiddleware, getPositionHandler);
router.get("/get_userposition", authMiddleware, getPositionHandler);
router.get("/get_userposit", authMiddleware, getPositionHandler);

router.get("/fills", authMiddleware, async (req: AuthRequest, res: Response) => {
  const market = (req.query.market as string) || (req.body.market as string);
  if (!market) {
    return res.status(400).json({ success: false, error: "Missing required parameter: market" });
  }
  try {
    const marketRecord = await client.market.findUnique({ where: { market_slug: market } });
    if (!marketRecord) {
      return res.json({ success: true, fills: [] });
    }
    const rows = await client.fills.findMany({
      where: {
        marketId: marketRecord.id,
        OR: [{ maker_id: req.userId! }, { taker_id: req.userId! }],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, price: true, qty: true, maker_id: true, createdAt: true },
    });
    const fills = rows.map((f) => ({
      id: f.id,
      price: f.price,
      qty: f.qty,
      role: f.maker_id === req.userId ? "maker" : "taker",
      createdAt: f.createdAt,
    }));
    return res.json({ success: true, fills });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
