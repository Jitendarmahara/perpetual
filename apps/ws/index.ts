import { WebSocketServer } from "ws";
import { UserManager } from "./userManager";
import Jwt from "jsonwebtoken";
import "./broadcaster";
import { wsConnectionErrorsTotal } from "./metrics";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws, req) => {
  const token = new URLSearchParams(req.url!.split("?")[1]).get("token");

  if (!token) {
    ws.close(1008, "Missing token");
    return;
  }

  try {
    const payload = Jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
    };
    UserManager.getInstance().adduser(payload.userId, ws);
  } catch (err) {
    ws.close(1008, "Invalid token");
    wsConnectionErrorsTotal.inc();
  }
});

