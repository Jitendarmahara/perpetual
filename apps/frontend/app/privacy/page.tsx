import Link from "next/link";
import { ArrowLeft, Database, LockKeyhole, ShieldCheck } from "lucide-react";
import { BrandLink } from "@/src/components/marketing/Brand";

const privacyItems = [
  {
    icon: Database,
    title: "Stored account data",
    body: "Backpack Futures stores account email, hashed password data, auth state, and sandbox trading activity needed to run this demo exchange.",
  },
  {
    icon: ShieldCheck,
    title: "Sandbox market records",
    body: "Demo balances, orders, positions, fills, and market activity are used only for the local sandbox workflow and are not real funds.",
  },
  {
    icon: LockKeyhole,
    title: "Credential guidance",
    body: "Do not enter production credentials, private keys, seed phrases, or private wallet information in this environment.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#07090d] px-4 text-[#f7fbff]">
      <header className="mx-auto flex h-20 w-full max-w-5xl items-center justify-between border-b border-white/10">
        <BrandLink />
        <Link href="/signin" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-[#aab4c0] transition hover:bg-white/[0.05] hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Sign in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl py-14">
        <div className="mb-10">
          <div className="mb-3 text-sm font-semibold text-lime">Privacy</div>
          <h1 className="text-4xl font-bold text-white">How this sandbox handles data.</h1>
          <p className="mt-4 text-sm leading-7 text-[#aab4c0]">
            This page describes the local demo workflow, not a production financial service.
          </p>
        </div>

        <div className="space-y-4">
          {privacyItems.map(({ icon: Icon, title, body }) => (
            <section key={title} className="rounded-lg border border-white/10 bg-[#0c121b] p-5">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-lime/[0.08] text-lime">
                  <Icon className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-bold text-white">{title}</h2>
              </div>
              <p className="text-sm leading-7 text-[#aab4c0]">{body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
