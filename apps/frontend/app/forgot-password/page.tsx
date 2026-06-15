"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, ShieldAlert, Wallet } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(
      "Password reset is not available in the backend yet. Contact the sandbox administrator to reset this account.",
    );
  };

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white flex flex-col items-center px-4">
      <header className="w-full max-w-5xl h-20 flex items-center justify-between border-b border-[#24303f]/40">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#e9fc50] flex items-center justify-center">
            <Wallet className="w-5 h-5 text-[#0b0e11]" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            BACKPACK<span className="text-[#e9fc50] font-extrabold font-mono ml-0.5">FUTURES</span>
          </span>
        </Link>
        <Link href="/signin" className="text-xs text-[#848e9c] hover:text-white flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Sign in
        </Link>
      </header>

      <main className="w-full max-w-md my-16">
        <div className="bg-[#141a22]/80 border border-[#24303f]/80 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-2xl font-bold tracking-tight mb-2">Recover Account</h1>
          <p className="text-sm text-[#848e9c] mb-6">
            Enter the email for the sandbox account.
          </p>

          {message && (
            <div className="mb-6 p-4 bg-[#f84960]/10 border border-[#f84960]/20 rounded-xl flex items-start gap-3 text-sm text-[#f84960]">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#848e9c] uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#848e9c]/60" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@domain.com"
                  className="w-full bg-[#0b0e11]/60 border border-[#24303f] focus:border-[#e9fc50] rounded-xl py-3.5 pl-12 pr-4 text-sm text-white placeholder-[#848e9c]/40 outline-none transition-all duration-200"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#e9fc50] hover:bg-[#d8ea3d] text-[#0b0e11] font-bold rounded-xl py-4 transition-all duration-200"
            >
              Check Recovery Status
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
