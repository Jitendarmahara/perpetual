import { SubscriptionManager } from "./SubscriptionManager";
import { User } from "./user";
import { WebSocket } from "ws";
// this function manages the user
export class UserManager {
  private static instance: UserManager;
  private usermap: Map<string, Set<User>> = new Map();

  public static getInstance() {
    if (!this.instance) {
      this.instance = new UserManager();
    }
    return this.instance;
  }

  public adduser(userId: string, ws: WebSocket) {
    const user = new User(userId, ws);
    const existingUsers = this.usermap.get(userId);
    if (existingUsers) {
      existingUsers.add(user);
    } else {
      this.usermap.set(userId, new Set([user]));
    }
    this.RegisterOnclose(ws, userId, user);
    return user;
  }

  public RegisterOnclose(ws: WebSocket, id: string, user: User) {
    ws.on("close", () => {
      const users = this.usermap.get(id);
      if (!users) return;

      users.delete(user);
      if (users.size === 0) {
        this.usermap.delete(id);
        SubscriptionManager.getInstance().userleft(id);
      }
    });
  }
  public getuser(id: string) {
    return this.usermap.get(id)?.values().next().value;
  }

  public emit(id: string, message: string) {
    this.usermap.get(id)?.forEach((user) => user.emit(message));
  }
}
