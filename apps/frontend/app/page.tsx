import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Cpu,
  Database,
  Gauge,
  Layers,
  LockKeyhole,
  Radio,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";
import { PublicHeader } from "@/src/components/marketing/Brand";

type Tone = "up" | "down" | "flat";

const markets: Array<{
  symbol: string;
  price: string;
  change: string;
  volume: string;
  funding: string;
  tone: Tone;
}> = [
  { symbol: "SOL-PERP", price: "172.48", change: "+3.82%", volume: "$184M", funding: "0.011%", tone: "up" },
  { symbol: "BTC-PERP", price: "98,214.10", change: "+1.14%", volume: "$1.8B", funding: "0.006%", tone: "up" },
  { symbol: "ETH-PERP", price: "3,684.22", change: "-0.42%", volume: "$942M", funding: "0.004%", tone: "down" },
  { symbol: "JUP-PERP", price: "1.284", change: "+5.91%", volume: "$48M", funding: "0.019%", tone: "up" },
  { symbol: "AVAX-PERP", price: "42.18", change: "+2.95%", volume: "$76M", funding: "0.012%", tone: "up" },
  { symbol: "ARB-PERP", price: "0.872", change: "+0.60%", volume: "$33M", funding: "0.003%", tone: "flat" },
];

const chartBars = [38, 46, 41, 58, 52, 64, 57, 70, 62, 76, 69, 84, 79, 91, 86, 96, 90, 100];

const bookRows = [
  { price: "172.54", size: "188.4", total: "412.8", side: "ask", width: "88%" },
  { price: "172.53", size: "94.6", total: "224.4", side: "ask", width: "64%" },
  { price: "172.52", size: "61.2", total: "129.8", side: "ask", width: "42%" },
  { price: "172.48", size: "Live", total: "12ms", side: "mid", width: "0%" },
  { price: "172.47", size: "134.1", total: "311.0", side: "bid", width: "74%" },
  { price: "172.46", size: "98.8", total: "176.9", side: "bid", width: "52%" },
  { price: "172.45", size: "78.1", total: "78.1", side: "bid", width: "34%" },
];

const heroStats = [
  { value: "$48.2B", label: "lifetime volume" },
  { value: "12ms", label: "median fill" },
  { value: "220+", label: "listed markets" },
  { value: "99.99%", label: "service uptime" },
];

const executionCards: Array<{
  icon: LucideIcon;
  title: string;
  body: string;
  metric: string;
}> = [
  {
    icon: Cpu,
    title: "Matching engine",
    body: "Price-time priority, deterministic fills, and a depth stream designed for active order flow.",
    metric: "sub-second confirmations",
  },
  {
    icon: Radio,
    title: "Realtime market data",
    body: "Candles, order book deltas, trades, and ticker updates flow into the desk without page refreshes.",
    metric: "websocket native",
  },
  {
    icon: ShieldCheck,
    title: "Margin controls",
    body: "Positions, leverage, liquidation levels, and available balance stay visible before every order.",
    metric: "risk-first trading",
  },
];

const workflow = [
  "Select a market with live mark, high, low, volume, and funding context.",
  "Choose limit or market, size the order from available balance, and set leverage.",
  "Track positions, open orders, fills, and PnL from the same trading desk.",
];

const riskItems = [
  { label: "Liquidation visibility", value: "Before and after entry" },
  { label: "Collateral mode", value: "USDC sandbox vault" },
  { label: "Order protection", value: "Quantity, price, and balance checks" },
  { label: "Position actions", value: "Close and refresh in one click" },
];

const apiRows = [
  { label: "Depth", value: "incremental order book updates" },
  { label: "Trades", value: "live fills and last traded price" },
  { label: "Candles", value: "1m to 1D history and live ticks" },
  { label: "User state", value: "positions, orders, fills, balances" },
];

function toneClass(tone: Tone) {
  if (tone === "up") return "text-bull";
  if (tone === "down") return "text-bear";
  return "text-[#c8d2df]";
}

function HeroTerminal() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 noise-mask" />
      <div className="absolute inset-x-4 top-20 mx-auto max-w-6xl opacity-[0.58] sm:top-16 lg:opacity-75">
        <div className="terminal-surface grid min-h-[520px] grid-cols-1 gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 md:grid-cols-[1.5fr_0.9fr]">
          <div className="relative bg-[#070b10]/[0.92] p-4 sm:p-6">
            <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4 font-mono text-[11px] text-[#9aa8b8]">
              <span>SOL-PERP / USDC</span>
              <span className="text-bull">+3.82% 24H</span>
            </div>
            <div className="mb-6 grid grid-cols-3 gap-3 font-mono text-xs">
              {[
                ["Mark", "$172.48", "text-lime"],
                ["Index", "$172.44", "text-[#f7fbff]"],
                ["Funding", "0.011%", "text-bull"],
              ].map(([label, value, color]) => (
                <div key={label} className="rounded-md border border-white/[0.08] bg-white/[0.035] p-3">
                  <div className="mb-1 text-[10px] text-[#8d9aaa]">{label}</div>
                  <div className={`font-semibold ${color}`}>{value}</div>
                </div>
              ))}
            </div>
            <div className="relative h-64 overflow-hidden rounded-md border border-white/[0.08] bg-[#05070b] p-4">
              <div className="market-scan absolute inset-y-0 left-0 w-1/2" />
              <div className="absolute inset-0 grid-bg opacity-35" />
              <div className="relative flex h-full items-end gap-2">
                {chartBars.map((height, index) => {
                  const up = index % 3 !== 1;
                  return (
                    <div key={`${height}-${index}`} className="flex flex-1 flex-col justify-end">
                      <div
                        className={`w-full rounded-t-[3px] ${up ? "bg-bull" : "bg-bear"}`}
                        style={{ height: `${height}%`, opacity: up ? 0.78 : 0.66 }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-[#090e15]/95 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between font-mono text-[11px] text-[#9aa8b8]">
              <span>Order book</span>
              <span>Spread $0.01</span>
            </div>
            <div className="overflow-hidden rounded-md border border-white/[0.08]">
              {bookRows.map((row) => {
                const isBid = row.side === "bid";
                const isAsk = row.side === "ask";
                return (
                  <div
                    key={`${row.price}-${row.size}`}
                    className={`relative grid grid-cols-3 px-3 py-2 font-mono text-[11px] ${
                      row.side === "mid" ? "border-y border-white/10 bg-white/[0.045]" : "bg-[#070b10]"
                    }`}
                  >
                    {(isBid || isAsk) && (
                      <span
                        className={`absolute right-0 top-0 h-full ${isBid ? "bg-bull/[0.12]" : "bg-bear/[0.12]"}`}
                        style={{ width: row.width }}
                      />
                    )}
                    <span className={`relative font-semibold ${isBid ? "text-bull" : isAsk ? "text-bear" : "text-lime"}`}>
                      {row.price}
                    </span>
                    <span className="relative text-right text-[#dfe7ef]">{row.size}</span>
                    <span className="relative text-right text-[#8d9aaa]">{row.total}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-md border border-lime/20 bg-lime/[0.06] p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-lime">
                <Zap className="h-4 w-4" />
                Route ready
              </div>
              <div className="space-y-2 font-mono text-[11px] text-[#afbac8]">
                <div className="flex justify-between">
                  <span>Margin</span>
                  <span>$344.96</span>
                </div>
                <div className="flex justify-between">
                  <span>Leverage</span>
                  <span>5x</span>
                </div>
                <div className="flex justify-between">
                  <span>Est. liq</span>
                  <span className="text-bear">$148.32</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#07090d_0%,rgba(7,9,13,0.72)_42%,rgba(7,9,13,0.3)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-[linear-gradient(180deg,transparent,#07090d)]" />
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      <div className="mb-3 text-sm font-semibold text-lime">{eyebrow}</div>
      <h2 className="text-3xl font-bold leading-tight text-white md:text-5xl">{title}</h2>
      <p className="mt-4 text-base leading-7 text-[#aab4c0]">{body}</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#07090d] text-[#f7fbff]">
      <PublicHeader />

      <main>
        <section className="relative flex min-h-[calc(100svh-9rem)] items-center overflow-hidden border-b border-white/10">
          <HeroTerminal />
          <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-24">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-lime/20 bg-lime/[0.07] px-3 py-1.5 text-sm font-medium text-lime">
                <span className="h-2 w-2 rounded-full bg-bull" />
                Mainnet-style sandbox exchange
              </div>
              <h1 className="font-display text-5xl font-bold leading-[1.04] text-white sm:text-6xl lg:text-7xl">
                Backpack Futures Exchange
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-[#c4ceda]">
                A modern perpetual futures desk with live market data, margin-aware order entry,
                realtime positions, and a clean execution workflow for serious trading simulations.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/signin"
                  className="inline-flex items-center gap-2 rounded-md bg-lime px-5 py-3 text-sm font-bold text-[#07100d] transition hover:bg-[#f2ff75]"
                >
                  Open trading desk
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.045] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                >
                  Create account
                  <Wallet className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="mt-14 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
              {heroStats.map((stat) => (
                <div key={stat.label} className="rounded-lg border border-white/10 bg-[#0b1119]/[0.72] p-4 backdrop-blur">
                  <div className="font-mono text-2xl font-bold text-white">{stat.value}</div>
                  <div className="mt-1 text-xs text-[#9aa8b8]">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="markets" className="border-b border-white/10 bg-[#090d13]">
          <div className="mx-auto grid max-w-7xl gap-px px-4 py-4 sm:px-6 md:grid-cols-3 lg:grid-cols-6">
            {markets.map((market) => (
              <div key={market.symbol} className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-bold text-white">{market.symbol}</span>
                  <span className={`font-mono text-xs font-semibold ${toneClass(market.tone)}`}>{market.change}</span>
                </div>
                <div className="font-mono text-lg font-semibold text-white">{market.price}</div>
                <div className="mt-3 flex justify-between text-[11px] text-[#8d9aaa]">
                  <span>Vol {market.volume}</span>
                  <span>Fund {market.funding}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="execution" className="px-4 py-20 sm:px-6 lg:py-24">
          <SectionHeader
            eyebrow="Execution stack"
            title="Built around the workflows traders repeat all day."
            body="The interface keeps the chart, depth, order entry, and account state close together so every action has market and risk context."
          />

          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
            {executionCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="rounded-lg border border-white/10 bg-[#0c121b] p-6 transition hover:border-lime/30 hover:bg-[#101824]">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md border border-lime/20 bg-lime/[0.07] text-lime">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold text-white">{card.title}</h3>
                  <p className="mt-3 min-h-[5.25rem] text-sm leading-6 text-[#aab4c0]">{card.body}</p>
                  <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-sm font-semibold text-lime">
                    <CheckCircle2 className="h-4 w-4" />
                    {card.metric}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#0a0f16] px-4 py-20 sm:px-6 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="mb-3 text-sm font-semibold text-lime">Desk workflow</div>
              <h2 className="text-3xl font-bold leading-tight text-white md:text-5xl">
                From market selection to PnL tracking in one screen.
              </h2>
              <p className="mt-5 text-base leading-7 text-[#aab4c0]">
                The dashboard is intentionally dense: it prioritizes scanning, comparison, and repeated actions over marketing decoration.
              </p>
              <div className="mt-8 space-y-4">
                {workflow.map((item, index) => (
                  <div key={item} className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.045] font-mono text-sm text-lime">
                      {index + 1}
                    </div>
                    <p className="pt-1 text-sm leading-6 text-[#c4ceda]">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#0c121b] p-4">
              <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="text-sm font-semibold text-white">Portfolio snapshot</div>
                  <div className="mt-1 text-xs text-[#8d9aaa]">Simulated account state</div>
                </div>
                <div className="rounded-md bg-bull/10 px-3 py-1 font-mono text-xs font-bold text-bull">Healthy</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Available balance", "$24,800.00", "text-white"],
                  ["Open margin", "$3,442.91", "text-white"],
                  ["Unrealized PnL", "+$1,284.60", "text-bull"],
                  ["Maintenance risk", "18.4%", "text-lime"],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                    <div className="text-xs text-[#8d9aaa]">{label}</div>
                    <div className={`mt-2 font-mono text-xl font-bold ${color}`}>{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 overflow-hidden rounded-md border border-white/[0.08]">
                {[
                  ["SOL-PERP", "LONG", "5x", "+$812.40"],
                  ["BTC-PERP", "SHORT", "3x", "+$284.11"],
                  ["ETH-PERP", "LONG", "2x", "-$96.80"],
                ].map(([market, side, lev, pnl]) => {
                  const positive = pnl.startsWith("+");
                  return (
                    <div key={market} className="grid grid-cols-4 border-b border-white/[0.08] bg-[#070b10] px-3 py-3 font-mono text-xs last:border-b-0">
                      <span className="font-bold text-white">{market}</span>
                      <span className={side === "LONG" ? "text-bull" : "text-bear"}>{side}</span>
                      <span className="text-[#9aa8b8]">{lev}</span>
                      <span className={`text-right font-bold ${positive ? "text-bull" : "text-bear"}`}>{pnl}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="risk" className="px-4 py-20 sm:px-6 lg:py-24">
          <SectionHeader
            eyebrow="Risk command center"
            title="Every trade shows the numbers that matter before you send it."
            body="Leverage is only useful when the trader can see exposure, liquidation distance, available collateral, and resting orders without hunting through menus."
          />

          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 lg:grid-cols-4">
            {riskItems.map((item) => (
              <div key={item.label} className="rounded-lg border border-white/10 bg-[#0c121b] p-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-white/[0.045] text-lime">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <div className="text-sm font-semibold text-white">{item.label}</div>
                <div className="mt-2 text-sm leading-6 text-[#aab4c0]">{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#090d13] px-4 py-20 sm:px-6 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.95fr] lg:items-center">
            <div>
              <div className="mb-3 text-sm font-semibold text-lime">Data layer</div>
              <h2 className="text-3xl font-bold leading-tight text-white md:text-5xl">
                A frontend that reflects the backend you already built.
              </h2>
              <p className="mt-5 text-base leading-7 text-[#aab4c0]">
                The public site now points into the real product surface: candles, depth, user balances, orders, fills, websocket status, and deposit flow.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Database, label: "Persistence-ready" },
                  { icon: Activity, label: "Live market state" },
                  { icon: Layers, label: "Shared packages" },
                  { icon: Gauge, label: "Low-latency UI" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-semibold text-white">
                    <Icon className="h-4 w-4 text-lime" />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#0c121b] p-4 font-mono text-xs">
              <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
                <span className="text-[#c4ceda]">stream contract</span>
                <span className="text-bull">connected</span>
              </div>
              <div className="space-y-2">
                {apiRows.map((row) => (
                  <div key={row.label} className="grid grid-cols-[7rem_1fr] gap-3 rounded-md bg-[#070b10] px-3 py-3">
                    <span className="text-lime">{row.label}</span>
                    <span className="text-[#9aa8b8]">{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-md border border-lime/20 bg-lime/[0.06] p-4 text-[#c4ceda]">
                <div className="mb-2 flex items-center gap-2 text-lime">
                  <BarChart3 className="h-4 w-4" />
                  UI coverage
                </div>
                Chart, order book, order ticket, positions, orders, fills, auth, and funding entry are all reachable from the redesigned flow.
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-20 text-center sm:px-6 lg:py-24">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold leading-tight text-white md:text-5xl">
              Start from the desk, not a brochure.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#aab4c0]">
              Create a sandbox account, add demo collateral, and test the full exchange workflow from the dashboard.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-md bg-lime px-5 py-3 text-sm font-bold text-[#07100d] transition hover:bg-[#f2ff75]"
              >
                Create account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/signin"
                className="inline-flex items-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.045] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                View dashboard
                <Activity className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#07090d] px-4 py-8 text-sm text-[#8d9aaa] sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span>(c) 2026 Backpack Futures. Sandbox markets carry risk; trade responsibly.</span>
          <div className="flex gap-5">
            <Link href="/privacy" className="transition hover:text-white">Privacy</Link>
            <Link href="/terms" className="transition hover:text-white">Terms</Link>
            <Link href="/signin" className="transition hover:text-white">Trade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
