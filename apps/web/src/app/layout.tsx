import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StrategyForge — AI Trading Strategy Generator",
  description:
    "Generate, backtest, and score trading strategies with AI. For educational purposes only.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased`}>
        {children}
        <footer className="mt-16 border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
          For educational purposes only. Past performance does not guarantee
          future results. This is not investment advice.
        </footer>
      </body>
    </html>
  );
}
