"use client";

import dynamic from "next/dynamic";

// dynamic ssr:false must live inside a Client Component
const DashboardPage = dynamic(() => import("./DashboardPage"), { ssr: false });

export function ClientDashboardWrapper() {
  return <DashboardPage />;
}
