"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest, getApiErrorMessage } from "../../src/api";
import { API_ROUTES } from "../../src/config";
import { ShieldAlert, CheckCircle2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiRequest(API_ROUTES.signup, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name || undefined,
        }),
      });
      setSuccess("Account created successfully! Redirecting to login...");
      setFormData({ name: "", email: "", password: "", confirmPassword: "" });
      setTimeout(() => router.push("/signin"), 1500);
    } catch (err) {
      setError(getApiErrorMessage(err, "Signup failed. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ── Left: Visual panel ── */}
      <div className="hidden lg:flex relative bg-surface overflow-hidden items-center justify-center p-14">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute -top-20 -right-20 w-[28rem] h-[28rem] rounded-full bg-lime/12 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-bull/10 blur-3xl" />

        <div className="relative max-w-md w-full">
          <div className="text-xs text-lime font-semibold mb-4 tracking-wide uppercase">
            Three steps to your first trade
          </div>
          <ol className="space-y-6">
            {[
              ["Create an account", "Email + password. No KYC under $10k."],
              ["Fund your collateral vault", "On-ramp from card or deposit USDC directly."],
              ["Place your first order", "Pick a market, choose leverage, send it."],
            ].map(([title, desc], i) => (
              <li key={title} className="flex gap-4">
                <div className="w-9 h-9 shrink-0 rounded-xl bg-lime/10 text-lime font-display font-bold flex items-center justify-center text-sm">
                  {i + 1}
                </div>
                <div>
                  <div className="font-semibold">{title}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{desc}</div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10 glass rounded-2xl p-5 font-mono text-xs">
            <div className="flex justify-between text-muted-foreground mb-3">
              <span>Last 24h</span>
              <span className="text-bull">▲</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-muted-foreground">Volume</div>
                <div className="text-base mt-0.5">$2.4B</div>
              </div>
              <div>
                <div className="text-muted-foreground">Trades</div>
                <div className="text-base mt-0.5">1.2M</div>
              </div>
              <div>
                <div className="text-muted-foreground">Fills</div>
                <div className="text-base mt-0.5">12ms</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Form ── */}
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
            <h1 className="text-3xl font-display font-bold">Create your account.</h1>
            <p className="text-sm text-muted-foreground mt-2">It takes about thirty seconds.</p>

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
                <label className="text-xs font-medium text-muted-foreground">
                  Full Name <span className="text-muted-foreground/50">(optional)</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="mt-1.5 w-full h-11 px-4 rounded-xl bg-input border border-border focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20 transition font-mono text-sm placeholder-muted-foreground/40"
                />
              </div>

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
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <input
                  type="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="At least 6 characters"
                  className="mt-1.5 w-full h-11 px-4 rounded-xl bg-input border border-border focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20 transition font-mono text-sm placeholder-muted-foreground/40"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter password"
                  className="mt-1.5 w-full h-11 px-4 rounded-xl bg-input border border-border focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20 transition font-mono text-sm placeholder-muted-foreground/40"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-lime text-[#0b0e11] font-bold glow-lime hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-[#0b0e11]/30 border-t-[#0b0e11] rounded-full animate-spin" />
                ) : (
                  "Create account"
                )}
              </button>
            </form>

            <p className="mt-8 text-sm text-muted-foreground text-center">
              Already trading?{" "}
              <Link href="/signin" className="text-lime hover:underline font-semibold">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
