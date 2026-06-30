import Link from "next/link";
import { Activity, ArrowRight, BarChart3, LineChart, ShieldCheck, Zap } from "lucide-react";

type BrandLinkProps = {
  className?: string;
  compact?: boolean;
};

const navItems = [
  { href: "#markets",   label: "Markets",   icon: BarChart3,   live: false },
  { href: "#execution", label: "Execution", icon: Zap,         live: false },
  { href: "#risk",      label: "Risk",      icon: ShieldCheck, live: false },
  { href: "/signin",    label: "Live Desk", icon: Activity,    live: true  },
];

export function BrandMark() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-lime/25 bg-lime text-[#07100d] shadow-[0_0_0_1px_rgba(233,252,80,0.18),0_14px_36px_-24px_rgba(233,252,80,0.9)]">
      <LineChart className="h-5 w-5" />
    </div>
  );
}

export function BrandLink({ className = "", compact = false }: BrandLinkProps) {
  return (
    <Link href="/" className={`flex w-fit items-center gap-2.5 ${className}`}>
      <BrandMark />
      {!compact && (
        <span className="font-display text-[15px] font-bold leading-none text-[#f7fbff]">
          BACKPACK<span className="ml-1 font-mono text-[13px] text-lime">FUTURES</span>
        </span>
      )}
    </Link>
  );
}

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07090d]/[0.88] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <BrandLink />

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-[#aab4c0] transition hover:bg-white/[0.06] hover:text-white"
              >
                <Icon className="h-3.5 w-3.5 transition group-hover:text-lime" />
                {item.label}
                {item.live && (
                  <span className="relative ml-0.5 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bull opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-bull" />
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/signin"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-[#aab4c0] transition hover:bg-white/5 hover:text-white sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/signin"
            className="inline-flex items-center gap-2 rounded-md bg-lime px-3.5 py-2 text-sm font-bold text-[#07100d] transition hover:bg-[#f2ff75]"
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
