import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";

export default function PrivacyPage() {
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

      <main className="w-full max-w-3xl py-14">
        <h1 className="text-3xl font-bold tracking-tight mb-4">Privacy</h1>
        <div className="space-y-5 text-sm leading-7 text-[#c7d0dc]">
          <p>
            Backpack Futures stores account email, hashed password data, auth state, and sandbox trading activity needed to run this demo exchange.
          </p>
          <p>
            Demo balances, orders, positions, fills, and market activity are used only for the local sandbox workflow and are not real funds.
          </p>
          <p>
            Do not enter production credentials or private wallet information in this environment.
          </p>
        </div>
      </main>
    </div>
  );
}
