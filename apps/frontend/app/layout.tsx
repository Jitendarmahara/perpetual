import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";


export const metadata: Metadata = {
  title: "Backpack Futures | Perpetual Trading Sandbox",
  description: "Modern perpetual futures trading interface for sandbox markets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body className="antialiased bg-[#07090d] text-[#f7fbff] font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
