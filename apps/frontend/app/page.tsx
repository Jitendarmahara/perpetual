import Link from "next/link";

const tickers = [
  { sym: "SOL-PERP",  price: "172.48",       chg: "+3.82" },
  { sym: "BTC-PERP",  price: "98,214.10",    chg: "+1.14" },
  { sym: "ETH-PERP",  price: "3,684.22",     chg: "-0.42" },
  { sym: "JUP-PERP",  price: "1.284",        chg: "+5.91" },
  { sym: "WIF-PERP",  price: "2.471",        chg: "-2.10" },
  { sym: "BONK-PERP", price: "0.00003124",   chg: "+8.40" },
  { sym: "ARB-PERP",  price: "0.872",        chg: "+0.60" },
  { sym: "AVAX-PERP", price: "42.18",        chg: "+2.95" },
];

const features = [
  { icon: "⚡", title: "Sub-second matching",   desc: "A Rust-based engine that fills your orders before you can refresh the tab." },
  { icon: "◎", title: "Transparent funding",    desc: "Every rate calculation is on-chain and auditable. No hidden mechanics." },
  { icon: "⬢", title: "Cross-margin vaults",   desc: "One collateral pool, every market. Capital-efficient by default." },
  { icon: "▲", title: "50x leverage",           desc: "Push your conviction without bridging to another venue. Risk caps included." },
  { icon: "≋", title: "Realtime depth feed",    desc: "WebSocket order book with incremental updates. No polling, no lag." },
  { icon: "✦", title: "Self-custodial",         desc: "Your keys, your positions. We never touch your collateral." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0b0e11] text-[#f5f6f7]">
      {/* ── Site Header ── */}
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-lime to-bull flex items-center justify-center glow-lime">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#0b0e11]" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 7h7v7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-display font-bold text-[15px] tracking-tight">
              BACKPACK<span className="text-lime font-mono text-sm">FUTURES</span>
            </span>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#markets" className="hover:text-[#f5f6f7] transition">Markets</a>
            <a href="#features" className="hover:text-[#f5f6f7] transition">Features</a>
            <a href="#stats"    className="hover:text-[#f5f6f7] transition">Stats</a>
            <Link href="/dashboard" className="hover:text-[#f5f6f7] transition">Trade</Link>
          </nav>

          {/* Auth CTA */}
          <div className="flex items-center gap-2">
            <Link href="/signin" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-[#f5f6f7] transition">
              Sign in
            </Link>
            <Link href="/signup" className="px-4 py-2 text-sm font-semibold rounded-xl bg-lime text-[#0b0e11] hover:opacity-90 transition glow-lime">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-24">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            {/* Left copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-muted-foreground mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-bull animate-pulse-dot" />
                Mainnet live · 50x leverage
              </div>
              <h1 className="font-display text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight">
                Perps that <span className="text-lime">don&rsquo;t</span><br />
                blink under load.
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-lg leading-relaxed">
                A matching engine built for serious traders. Deep books, transparent funding,
                sub-second fills — and no custodial nonsense.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup" className="px-6 py-3 rounded-xl bg-lime text-[#0b0e11] font-bold glow-lime hover:opacity-90 transition">
                  Start trading
                </Link>
                <Link href="/dashboard" className="px-6 py-3 rounded-xl glass font-medium hover:bg-surface-2 transition">
                  Open dashboard →
                </Link>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
                {[
                  ["$2.4B",  "24h volume"],
                  ["180k+",  "Active traders"],
                  ["12ms",   "Median fill"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <div className="font-display font-bold text-2xl">{v}</div>
                    <div className="text-xs text-muted-foreground mt-1">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: mock chart card */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-tr from-lime/15 to-bull/15 blur-3xl opacity-50" />
              <div className="relative glass rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs text-muted-foreground">SOL-PERP</div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-2xl font-bold">172.48</span>
                      <span className="text-bull text-sm font-semibold">+3.82%</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {["1m", "5m", "1h", "1D"].map((t, i) => (
                      <button key={t} className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition ${i === 2 ? "bg-lime text-[#0b0e11]" : "text-muted-foreground hover:bg-surface-2"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sparkline SVG */}
                <svg viewBox="0 0 400 180" className="w-full h-44">
                  <defs>
                    <linearGradient id="hero-grad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%"   stopColor="#e9fc50" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#e9fc50" stopOpacity="0"    />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,130 L30,118 L60,125 L90,95 L120,105 L150,80 L180,90 L210,60 L240,75 L270,50 L300,65 L330,35 L360,48 L400,28"
                    fill="none" stroke="#e9fc50" strokeWidth="2.5"
                  />
                  <path
                    d="M0,130 L30,118 L60,125 L90,95 L120,105 L150,80 L180,90 L210,60 L240,75 L270,50 L300,65 L330,35 L360,48 L400,28 L400,180 L0,180 Z"
                    fill="url(#hero-grad)"
                  />
                </svg>

                {/* Mini order book */}
                <div className="grid grid-cols-2 gap-3 mt-4 text-xs font-mono">
                  <div className="space-y-1">
                    {[["172.49","124.2"],["172.50","88.4"],["172.51","210.0"]].map(([p, s]) => (
                      <div key={p} className="flex justify-between">
                        <span className="text-bear">{p}</span>
                        <span className="text-muted-foreground">{s}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {[["172.47","156.8"],["172.46","94.1"],["172.45","302.5"]].map(([p, s]) => (
                      <div key={p} className="flex justify-between">
                        <span className="text-bull">{p}</span>
                        <span className="text-muted-foreground">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ticker tape ── */}
      <section id="markets" className="border-y border-border bg-surface/40 py-4 overflow-hidden">
        <div className="flex animate-ticker whitespace-nowrap">
          {[...tickers, ...tickers].map((t, i) => (
            <div key={i} className="flex items-center gap-3 px-8 font-mono text-sm">
              <span className="text-muted-foreground">{t.sym}</span>
              <span>{t.price}</span>
              <span className={t.chg.startsWith("-") ? "text-bear" : "text-bull"}>{t.chg}%</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24">
        <div className="max-w-2xl mb-14">
          <div className="text-sm text-lime font-semibold mb-3">Built different</div>
          <h2 className="font-display text-4xl md:text-5xl font-bold">
            Engineered for the people who actually trade.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6 hover:bg-surface-2 transition group">
              <div className="w-10 h-10 rounded-xl bg-lime/10 text-lime flex items-center justify-center text-lg mb-4 group-hover:bg-lime group-hover:text-[#0b0e11] transition">
                {f.icon}
              </div>
              <div className="font-display font-semibold text-lg mb-2">{f.title}</div>
              <div className="text-sm text-muted-foreground leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section id="stats" className="max-w-7xl mx-auto px-6 pb-24">
        <div className="glass rounded-3xl p-10 md:p-14 relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-96 h-96 rounded-full bg-lime/8 blur-3xl" />
          <div className="relative grid md:grid-cols-4 gap-8">
            {[
              ["$48.2B", "Lifetime volume"],
              ["1.2M",   "Trades / day"],
              ["220+",   "Listed markets"],
              ["99.99%", "Uptime"],
            ].map(([v, l]) => (
              <div key={l}>
                <div className="font-display font-bold text-4xl text-lime">{v}</div>
                <div className="text-sm text-muted-foreground mt-2">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-4xl mx-auto px-6 pb-24 text-center">
        <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">Ready when you are.</h2>
        <p className="text-muted-foreground mb-8 text-lg">
          Spin up an account in under thirty seconds. No KYC for under $10k volume.
        </p>
        <Link
          href="/signup"
          className="inline-block px-8 py-4 rounded-xl bg-lime text-[#0b0e11] font-bold glow-lime hover:opacity-90 transition text-base"
        >
          Create your account
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span>© 2026 Backpack Futures. Markets carry risk — only trade with capital you can afford to lose.</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-[#f5f6f7] transition">Privacy</Link>
            <Link href="/terms"   className="hover:text-[#f5f6f7] transition">Terms</Link>
            <Link href="/dashboard" className="hover:text-[#f5f6f7] transition">Trade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
