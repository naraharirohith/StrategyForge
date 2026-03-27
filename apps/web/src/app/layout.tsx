import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { ClientProviders } from "./providers";

export const metadata: Metadata = {
  title: "StrategyForge | Premium Strategy Lab",
  description:
    "Generate, backtest, and refine AI-powered trading strategies with deeper context, better presentation, and honest analytics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="app-body antialiased">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute left-[-12rem] top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(234,174,88,0.22),transparent_70%)] blur-3xl" />
          <div className="absolute right-[-10rem] top-[8rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(66,165,201,0.18),transparent_72%)] blur-3xl" />
          <div className="absolute bottom-[-12rem] left-[20%] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,rgba(198,120,221,0.14),transparent_72%)] blur-3xl" />
        </div>

        <div className="relative z-10 flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-[color:var(--border-soft)] bg-[rgba(11,13,18,0.72)] backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <Link href="/" className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-lg font-semibold text-[color:var(--accent)] shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
                  SF
                </span>
                <span>
                  <span className="block text-[10px] uppercase tracking-[0.32em] text-[color:var(--ink-soft)]">Premium Research Desk</span>
                  <span className="block text-lg font-semibold text-[color:var(--ink-strong)]">StrategyForge</span>
                </span>
              </Link>

              <nav className="flex flex-wrap items-center gap-2">
                <Link href="/" className="nav-pill">
                  Generator
                </Link>
                <Link href="/dashboard" className="nav-pill">
                  Dashboard
                </Link>
                <Link href="/compare" className="nav-pill">
                  Compare
                </Link>
              </nav>
            </div>
          </header>

          <main className="flex-1">
            <ClientProviders>{children}</ClientProviders>
          </main>

          <footer className="relative z-10 mt-10 border-t border-[color:var(--border-soft)] bg-[rgba(10,12,17,0.72)]">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-[color:var(--ink-soft)] sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
              <p>Strategy research for education and exploration only.</p>
              <p>Past performance is not predictive. This is not investment advice.</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
