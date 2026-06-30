
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, ShieldAlert } from "lucide-react";
import { BrandLink } from "@/src/components/marketing/Brand";

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
    <div className="min-h-screen bg-[#07090d] px-4 text-[#f7fbff]">
      <header className="mx-auto flex h-20 w-full max-w-5xl items-center justify-between border-b border-white/10">
        <BrandLink />
        <Link href="/signin" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-[#aab4c0] transition hover:bg-white/[0.05] hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Sign in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-16">
        <div className="rounded-lg border border-white/10 bg-[#0c121b] p-7 shadow-2xl">
          <div className="mb-3 text-sm font-semibold text-lime">Account recovery</div>
          <h1 className="text-3xl font-bold text-white">Recover account</h1>
          <p className="mt-3 text-sm leading-6 text-[#aab4c0]">
            Enter the email for the sandbox account and the app will show the current recovery status.
          </p>

          {message && (
            <div className="mt-6 flex items-start gap-3 rounded-lg border border-bear/25 bg-bear/10 p-4 text-sm text-bear">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-xs font-semibold text-[#9aa8b8]">Email address</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#758395]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@domain.com"
                  className="h-12 w-full rounded-lg border border-white/10 bg-[#0b1018] px-10 text-sm text-white outline-none transition placeholder:text-[#667386] focus:border-lime/60 focus:ring-2 focus:ring-lime/15"
                />
              </div>
            </div>

            <button
              type="submit"
              className="h-12 w-full rounded-lg bg-lime text-sm font-bold text-[#07100d] transition hover:bg-[#f2ff75]"
            >
              Check recovery status
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
