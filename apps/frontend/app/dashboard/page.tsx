"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Position } from "../../src/types/trading";
import { useAuth } from "../../src/hooks/useAuth";
import { useMarketData } from "../../src/hooks/useMarketData";
import { useTrading } from "../../src/hooks/useTrading";
import { useWebSocket } from "../../src/hooks/useWebSocket";
import { Header } from "../../src/components/dashboard/Header";
import { CandleChart } from "../../src/components/dashboard/CandleChart";
import { OrderBook } from "../../src/components/dashboard/OrderBook";
import { OrderForm } from "../../src/components/dashboard/OrderForm";
import { PositionsPanel } from "../../src/components/dashboard/PositionsPanel";
import { OnrampModal } from "../../src/components/dashboard/OnrampModal";

export default function Dashboard() {
  const [selectedMarket, setSelectedMarket] = useState("SOL_USDC");
  const [showOnrampModal, setShowOnrampModal] = useState(false);

  const { token, userEmail, signout, handleApiAuthError } = useAuth();

  const market = useMarketData(selectedMarket);

  const trading = useTrading(token, selectedMarket, handleApiAuthError, signout);

  // Fetch user data on mount and when market/token changes so openOrders is
  // always populated — this ensures the maker's WS orderUpdate triggers correctly
  useEffect(() => {
    if (token) trading.fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedMarket]);

  // Track the most recent place-order timestamp so handleTrade knows to refresh
  const recentOrderRef = useRef(0);

  // WebSocket handlers — stable references via useCallback so the WS hook
  // doesn't reconnect on every render
  const handleDepth = useCallback(
    (rawBids: unknown, rawAsks: unknown) => market.applyIncrementalDepth(rawBids, rawAsks),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [market.applyIncrementalDepth],
  );
  const handleTrade = useCallback(
    (price: number, qty: number) => {
      market.applyTradeTick(price, qty);
      // If the user has resting orders OR just placed one within the last 3s,
      // a fill in the market might involve them — refresh their data.
      const hasResting = trading.openOrders.length > 0;
      const justPlaced = Date.now() - recentOrderRef.current < 3000;
      if (hasResting || justPlaced) {
        trading.fetchUserData();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [market.applyTradeTick, trading.openOrders, trading.fetchUserData],
  );
  const handleTicker = useCallback(
    (price: number) => market.applyTickerPrice(price),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [market.applyTickerPrice],
  );

  const handleOrderEvent = useCallback(
    (orderId: string) => {
      if (trading.openOrders.some((o) => o.id === orderId)) {
        trading.fetchUserData();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trading.fetchUserData, trading.openOrders],
  );

  const { wsStatus } = useWebSocket(selectedMarket, token, {
    onDepth: handleDepth,
    onTrade: handleTrade,
    onOrderEvent: handleOrderEvent,
    onTicker: handleTicker,
  });

  const handlePlaceOrder = useCallback(
    (side: Parameters<typeof trading.placeOrder>[0], orderType: Parameters<typeof trading.placeOrder>[1], qty: number, price: number | null, leverage: number) => {
      recentOrderRef.current = Date.now();
      trading.placeOrder(side, orderType, qty, price, leverage, () => {
        trading.fetchUserData();
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trading.placeOrder, trading.fetchUserData],
  );

  const handleCancelOrder = useCallback(
    (orderId: string) => {
      trading.cancelOrder(orderId, () => {
        trading.fetchUserData();
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trading.cancelOrder, trading.fetchUserData],
  );

  const handleClosePosition = useCallback(
    (pos: Position) => {
      const closeSide = pos.type === "LONG" ? "SHORT" : "LONG";
      trading.closePosition(closeSide, pos.qty, pos.leverage, () => {
        trading.fetchUserData();
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trading.closePosition, trading.fetchUserData],
  );

  const handleOnramp = useCallback(
    (amount: number) => {
      trading.onramp(amount, () => {
        setShowOnrampModal(false);
        trading.fetchUserData();
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trading.onramp, trading.fetchUserData],
  );

  return (
    <div className="min-h-screen bg-[#0b0e11] text-[#f5f6f7] flex flex-col font-sans select-none overflow-x-hidden">
      <Header
        selectedMarket={selectedMarket}
        onMarketChange={setSelectedMarket}
        markPrice={market.markPrice}
        priceChange24h={market.priceChange24h}
        priceHigh24h={market.priceHigh24h}
        priceLow24h={market.priceLow24h}
        volume24h={market.volume24h}
        balance={trading.balance}
        wsStatus={wsStatus}
        userEmail={userEmail}
        onDepositClick={() => setShowOnrampModal(true)}
        onSignout={signout}
      />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Chart + Positions/Orders panel */}
        <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-border min-h-0">
          <CandleChart
            market={selectedMarket}
            lastTradedPrice={market.lastTradedPrice}
            lastTrade={market.lastTrade}
          />
          <PositionsPanel
            positions={trading.positions}
            openOrders={trading.openOrders}
            fills={trading.fills}
            selectedMarket={selectedMarket}
            lastTradedPrice={market.lastTradedPrice}
            error={trading.error}
            infoMessage={trading.infoMessage}
            closeLoading={trading.orderLoading}
            cancelLoading={trading.cancelLoading}
            onCancelOrder={handleCancelOrder}
            onClosePosition={handleClosePosition}
            onRefresh={trading.fetchUserData}
          />
        </div>

        {/* Right: Order Book + Order Form */}
        <div className="w-full lg:w-96 flex flex-col border-b lg:border-b-0 border-border shrink-0 bg-surface/30">
          <OrderBook
            market={selectedMarket}
            bids={market.bids}
            asks={market.asks}
            maxTotalVolume={market.maxTotalVolume}
            lastTradedPrice={market.lastTradedPrice}
            marketError={market.marketError}
            onPriceClick={() => {}}
          />
          <OrderForm
            market={selectedMarket}
            lastTradedPrice={market.lastTradedPrice}
            bestBid={market.bids[0]?.price ?? 0}
            bestAsk={market.asks[market.asks.length - 1]?.price ?? 0}
            balance={trading.balance}
            error={trading.error}
            infoMessage={trading.infoMessage}
            orderLoading={trading.orderLoading}
            onPlaceOrder={handlePlaceOrder}
          />
        </div>
      </div>

      {showOnrampModal && (
        <OnrampModal
          loading={trading.onrampLoading}
          onClose={() => setShowOnrampModal(false)}
          onSubmit={handleOnramp}
        />
      )}
    </div>
  );
}
