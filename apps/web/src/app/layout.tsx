import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "./providers";

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
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
            <a href="/" className="text-lg font-bold text-slate-900">
              Strategy<span className="text-blue-600">Forge</span>
            </a>
            <nav className="flex gap-4 text-sm">
              <a href="/" className="text-slate-600 hover:text-slate-900">Generator</a>
              <a href="/dashboard" className="text-slate-600 hover:text-slate-900">Dashboard</a>
              <a href="/compare" className="text-slate-600 hover:text-slate-900">Compare</a>
            </nav>
          </div>
        </header>
        <ClientProviders>{children}</ClientProviders>
        <footer className="mt-16 border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
          For educational purposes only. Past performance does not guarantee
          future results. This is not investment advice.
        </footer>
      </body>
    </html>
  );
}
