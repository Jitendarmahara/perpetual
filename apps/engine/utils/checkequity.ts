import { Balance } from "../stor/echangestore";

// this function finds the avaliable balance or equity for this user;
export function AvailableEquity(userId: string) {
  const balance = Balance.get(userId);
  if (!balance) {
    return {
      success: false,
      error: "user balance not found",
    };
  }
  const availablebalance = balance.available;
  return {
    success: true,
    balance: availablebalance,
  };
}
