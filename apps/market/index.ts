import { startMarketProcess } from "./src/simulator";

startMarketProcess().catch((error) => {
  console.error("market process crashed:", error);
  process.exit(1);
});
