"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { apiRequest, getApiErrorMessage } from "../../src/api";
import { API_ROUTES } from "../../src/config";
import { BrandLink } from "@/src/components/marketing/Brand";

type SigninResponse = {
  success: boolean;
  token: string;
};

const demoCredentials = {
  email: "jitendarmahara2002@gmail.com",
  password: "hellohello",
};

const sessionStats = [
  ["24h volume", "$2.4B"],
  ["Trades", "1.2M"],
  ["Median fill", "12ms"],
];

export default function SigninPage() {
  const router = useRouter();
  const [formData, setFormData] = useState(demoCredentials);
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
      setSuccess("Authenticated. Opening the trading desk...");
      setTimeout(() => router.push("/dashboard"), 1000);
    } catch (err) {
      setError(getApiErrorMessage(err, "Signin failed. Check your credentials."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090d] text-[#f7fbff]">
      <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
        <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-14">
          <BrandLink />

          <div className="flex flex-1 items-center py-12">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8">
                <div className="mb-3 text-sm font-semibold text-lime">Secure access</div>
                <h1 className="text-4xl font-bold leading-tight text-white">Welcome back.</h1>
                <p className="mt-3 text-sm leading-6 text-[#aab4c0]">
                  Sign in to manage positions, orders, balances, and realtime market data from the trading desk.
                </p>
              </div>

              {error && (
                <div className="mb-4 flex items-start gap-3 rounded-lg border border-bear/25 bg-bear/10 p-4 text-sm text-bear animate-fadeIn">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="mb-4 flex items-start gap-3 rounded-lg border border-bull/25 bg-bull/10 p-4 text-sm text-bull animate-fadeIn">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="mb-2 block text-xs font-semibold text-[#9aa8b8]">Email</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#758395]" />
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@domain.com"
                      className="h-12 w-full rounded-lg border border-white/10 bg-[#0b1018] px-10 text-sm text-white outline-none transition placeholder:text-[#667386] focus:border-lime/60 focus:ring-2 focus:ring-lime/15"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#9aa8b8]">Password</label>
                    <Link href="/forgot-password" className="text-xs font-semibold text-lime hover:text-[#f2ff75]">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#758395]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Enter password"
                      className="h-12 w-full rounded-lg border border-white/10 bg-[#0b1018] px-10 pr-12 text-sm text-white outline-none transition placeholder:text-[#667386] focus:border-lime/60 focus:ring-2 focus:ring-lime/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#8d9aaa] transition hover:bg-white/[0.06] hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-lime text-sm font-bold text-[#07100d] transition hover:bg-[#f2ff75] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {loading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#07100d]/30 border-t-[#07100d]" />
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled
                  className="flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] text-sm font-semibold text-[#7f8c9e]"
                >
                  <Wallet className="h-4 w-4" />
                  Wallet sign-in coming soon
                </button>
              </form>

              <p className="mt-8 text-center text-sm text-[#9aa8b8]">
                New to Backpack Futures?{" "}
                <Link href="/signup" className="font-semibold text-lime hover:text-[#f2ff75]">
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </section>

        <section className="hidden min-h-screen border-l border-white/10 bg-[#090d13] p-8 lg:flex">
          <div className="terminal-surface relative flex w-full flex-col justify-between overflow-hidden rounded-lg border border-white/10 p-8">
            <div className="absolute inset-0 grid-bg opacity-25" />
            <div className="relative">
              <div className="mb-8 inline-flex items-center gap-2 rounded-md border border-bull/25 bg-bull/10 px-3 py-1.5 text-sm font-semibold text-bull">
                <span className="h-2 w-2 rounded-full bg-bull" />
                Session protected
              </div>
              <h2 className="max-w-lg text-4xl font-bold leading-tight text-white">
                Return straight to live orders and portfolio state.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-[#aab4c0]">
                The signed-in desk keeps order entry, charting, positions, fills, and deposits in one focused workspace.
              </p>
            </div>

            <div className="relative space-y-4">
              <div className="rounded-lg border border-white/10 bg-[#070b10]/[0.74] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-mono text-sm text-[#aab4c0]">SOL-PERP position</span>
                  <span className="rounded-md bg-bull/10 px-2 py-1 font-mono text-xs font-bold text-bull">+18.4%</span>
                </div>
                <div className="font-mono text-3xl font-bold text-white">+$4,219.86</div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-3/4 rounded-full bg-lime" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {sessionStats.map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                    <div className="text-xs text-[#8d9aaa]">{label}</div>
                    <div className="mt-2 font-mono text-lg font-bold text-white">{value}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-lime/20 bg-lime/[0.06] p-4 font-mono text-xs text-[#c4ceda]">
                <div className="mb-2 text-lime">last fill</div>
                <div className="flex justify-between">
                  <span>LONG 5x SOL @ 172.48</span>
                  <span className="text-bull">FILLED</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
