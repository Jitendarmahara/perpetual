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
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";
import { apiRequest, getApiErrorMessage } from "../../src/api";
import { API_ROUTES } from "../../src/config";
import { BrandLink } from "@/src/components/marketing/Brand";

const onboardingSteps = [
  ["Create account", "Use email and password to open the sandbox desk."],
  ["Add demo collateral", "Fund the USDC vault from the deposit modal."],
  ["Place orders", "Trade market or limit orders with visible margin."],
];

const accountPerks = [
  "Realtime order book and candle updates",
  "Positions, fills, and open orders in one panel",
  "Margin and liquidation context before every trade",
];

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      setSuccess("Account created. Redirecting to sign in...");
      setFormData({ name: "", email: "", password: "", confirmPassword: "" });
      setTimeout(() => router.push("/signin"), 1500);
    } catch (err) {
      setError(getApiErrorMessage(err, "Signup failed. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090d] text-[#f7fbff]">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden min-h-screen border-r border-white/10 bg-[#090d13] p-8 lg:flex">
          <div className="terminal-surface relative flex w-full flex-col justify-between overflow-hidden rounded-lg border border-white/10 p-8">
            <div className="absolute inset-0 grid-bg opacity-25" />
            <div className="relative">
              <div className="mb-8 inline-flex items-center gap-2 rounded-md border border-lime/25 bg-lime/[0.07] px-3 py-1.5 text-sm font-semibold text-lime">
                <Wallet className="h-4 w-4" />
                Sandbox onboarding
              </div>
              <h2 className="max-w-lg text-4xl font-bold leading-tight text-white">
                Go from account to first simulated position in minutes.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-[#aab4c0]">
                The signup flow lands you in the same exchange workspace used for charting, order entry, risk checks, and fills.
              </p>
            </div>

            <div className="relative space-y-4">
              {onboardingSteps.map(([title, body], index) => (
                <div key={title} className="flex gap-4 rounded-lg border border-white/10 bg-[#070b10]/[0.74] p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-lime text-sm font-bold text-[#07100d]">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{title}</div>
                    <div className="mt-1 text-sm leading-6 text-[#aab4c0]">{body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-14">
          <BrandLink />

          <div className="flex flex-1 items-center py-12">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8">
                <div className="mb-3 text-sm font-semibold text-lime">Create access</div>
                <h1 className="text-4xl font-bold leading-tight text-white">Create your account.</h1>
                <p className="mt-3 text-sm leading-6 text-[#aab4c0]">
                  Set up a sandbox trading profile and start testing the full perpetual futures workflow.
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
                  <label className="mb-2 block text-xs font-semibold text-[#9aa8b8]">
                    Full name <span className="font-normal text-[#667386]">(optional)</span>
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#758395]" />
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Alex Trader"
                      className="h-12 w-full rounded-lg border border-white/10 bg-[#0b1018] px-10 text-sm text-white outline-none transition placeholder:text-[#667386] focus:border-lime/60 focus:ring-2 focus:ring-lime/15"
                    />
                  </div>
                </div>

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
                  <label className="mb-2 block text-xs font-semibold text-[#9aa8b8]">Password</label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#758395]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="At least 6 characters"
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

                <div>
                  <label className="mb-2 block text-xs font-semibold text-[#9aa8b8]">Confirm password</label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#758395]" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Re-enter password"
                      className="h-12 w-full rounded-lg border border-white/10 bg-[#0b1018] px-10 pr-12 text-sm text-white outline-none transition placeholder:text-[#667386] focus:border-lime/60 focus:ring-2 focus:ring-lime/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#8d9aaa] transition hover:bg-white/[0.06] hover:text-white"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                      Create account
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                  <ShieldCheck className="h-4 w-4 text-lime" />
                  Included after signup
                </div>
                <div className="space-y-2">
                  {accountPerks.map((perk) => (
                    <div key={perk} className="flex items-center gap-2 text-sm text-[#aab4c0]">
                      <CheckCircle2 className="h-4 w-4 text-bull" />
                      {perk}
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-8 text-center text-sm text-[#9aa8b8]">
                Already have an account?{" "}
                <Link href="/signin" className="font-semibold text-lime hover:text-[#f2ff75]">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
