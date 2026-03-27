import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
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
      <body className={`${inter.className} antialiased`}>
        <header className="sticky top-0 z-50 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]/80 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-accent)] text-xs font-bold text-white">
                SF
              </span>
              <span className="text-base font-semibold text-[var(--color-text-primary)] tracking-tight">
                Strategy<span className="text-[var(--color-accent)]">Forge</span>
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-md px-3 py-1.5 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)]"
              >
                Generator
              </Link>
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-1.5 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)]"
              >
                Dashboard
              </Link>
              <Link
                href="/compare"
                className="rounded-md px-3 py-1.5 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)]"
              >
                Compare
              </Link>
            </nav>
          </div>
        </header>

        <ClientProviders>{children}</ClientProviders>

        <footer className="mt-16 border-t border-[var(--color-border-subtle)] py-6 text-center text-xs text-[var(--color-text-muted)]">
          For educational purposes only. Past performance does not guarantee
          future results. This is not investment advice.
        </footer>
      </body>
    </html>
  );
}
