"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest, getApiErrorMessage } from "../../src/api";
import { API_ROUTES } from "../../src/config";
import { ShieldAlert, CheckCircle2 } from "lucide-react";

type SigninResponse = {
  success: boolean;
  token: string;
};

export default function SigninPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<SigninResponse>(API_ROUTES.signin, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });
      if (!data.token) throw new Error("Signin succeeded but no auth token was returned.");
      localStorage.setItem("token", data.token);
      localStorage.setItem("userEmail", formData.email);
      setSuccess("Successfully authenticated! Redirecting to trading desk...");
      setTimeout(() => router.push("/dashboard"), 1000);
    } catch (err) {
      setError(getApiErrorMessage(err, "Signin failed. Check your credentials."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ── Left: Form ── */}
      <div className="flex flex-col px-8 sm:px-14 py-10">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 w-fit">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-lime to-bull flex items-center justify-center glow-lime">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#0b0e11]" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 7h7v7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-display font-bold text-xl tracking-tight">
            BACKPACK<span className="text-lime font-mono">FUTURES</span>
          </span>
        </Link>

        {/* Form */}
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-sm mx-auto">
            <h1 className="text-3xl font-display font-bold">Welcome back.</h1>
            <p className="text-sm text-muted-foreground mt-2">Sign in to keep your edge.</p>

            {error && (
              <div className="mt-5 p-4 bg-bear/10 border border-bear/20 rounded-2xl flex items-start gap-3 text-sm text-bear animate-fadeIn">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="mt-5 p-4 bg-bull/10 border border-bull/20 rounded-2xl flex items-start gap-3 text-sm text-bull animate-fadeIn">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@domain.com"
                  className="mt-1.5 w-full h-11 px-4 rounded-xl bg-input border border-border focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20 transition font-mono text-sm placeholder-muted-foreground/40"
                />
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-muted-foreground">Password</label>
                  <Link href="/forgot-password" className="text-xs text-lime hover:underline">Forgot?</Link>
                </div>
                <div className="relative mt-1.5">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••••"
                    className="w-full h-11 px-4 pr-16 rounded-xl bg-input border border-border focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20 transition font-mono text-sm placeholder-muted-foreground/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-lime text-[#0b0e11] font-bold glow-lime hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-[#0b0e11]/30 border-t-[#0b0e11] rounded-full animate-spin" />
                ) : (
                  "Sign in"
                )}
              </button>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex-1 h-px bg-border" />
                OR
                <div className="flex-1 h-px bg-border" />
              </div>

              <button
                type="button"
                className="w-full h-11 rounded-xl glass font-medium text-sm hover:bg-surface-2 transition flex items-center justify-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-bull" />
                Continue with Wallet
              </button>
            </form>

            <p className="mt-8 text-sm text-muted-foreground text-center">
              New here?{" "}
              <Link href="/signup" className="text-lime hover:underline font-semibold">
                Create an account
              </Link>
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Protected by industry-standard encryption.
        </p>
      </div>

      {/* ── Right: Visual panel ── */}
      <div className="hidden lg:flex relative bg-surface overflow-hidden items-center justify-center p-14">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-lime/15 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-bull/15 blur-3xl" />

        <div className="relative max-w-md w-full">
          {/* Mock position card */}
          <div className="glass rounded-2xl p-6 mb-4 rotate-1">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Position · SOL-PERP</span>
              <span className="text-bull">+18.4%</span>
            </div>
            <div className="font-mono text-2xl font-semibold">+$4,219.86</div>
            <div className="mt-3 h-1 bg-surface-2 rounded-full overflow-hidden">
              <div className="h-full w-3/4 bg-gradient-to-r from-lime to-bull" />
            </div>
          </div>

          {/* Mock fill card */}
          <div className="glass rounded-2xl p-6 -rotate-1 ml-8">
            <div className="text-xs text-muted-foreground mb-2">Fill confirmed · 12ms</div>
            <div className="font-mono text-sm flex justify-between">
              <span>LONG 50x @ 172.48</span>
              <span className="text-bull font-semibold">FILLED</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-8 glass rounded-2xl p-5 font-mono text-xs">
            <div className="flex justify-between text-muted-foreground mb-3">
              <span>Last 24 hours</span>
              <span className="text-bull">▲ Live</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-muted-foreground">Volume</div>
                <div className="text-base text-foreground mt-0.5">$2.4B</div>
              </div>
              <div>
                <div className="text-muted-foreground">Trades</div>
                <div className="text-base text-foreground mt-0.5">1.2M</div>
              </div>
              <div>
                <div className="text-muted-foreground">Median Fill</div>
                <div className="text-base text-foreground mt-0.5">12ms</div>
              </div>
            </div>
          </div>

          <blockquote className="mt-10 text-lg text-foreground/90 leading-relaxed">
            &ldquo;Finally a perps venue that doesn&rsquo;t lag during volatility. The book is real.&rdquo;
            <footer className="text-xs text-muted-foreground mt-3">— @degenwhale · 9-figure trader</footer>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
