"use client";

import { useState } from "react";
import { fmt, fmtCurrency, currencySymbol } from "@/lib/utils";

interface Trade {
  ticker: string;
  side: string;
  entry_date: string;
  entry_price: number;
  exit_date: string;
  exit_price: number;
  exit_reason: string;
  pnl: number;
  pnl_percent: number;
  holding_bars: number;
  commission_paid: number;
}

interface Props {
  trades: Trade[];
  currency?: string;
}

const EXIT_LABELS: Record<string, string> = {
  stop_loss: "Stop Loss",
  take_profit: "Take Profit",
  trailing_stop: "Trailing Stop",
  time_exit: "Time Exit",
  end_of_data: "End of Data",
};

export function TradeTable({ trades, currency = "USD" }: Props) {
  const symbol = currencySymbol(currency);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;
  const pages = Math.ceil(trades.length / PAGE_SIZE);
  const visible = trades.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function formatPrice(value: number) {
    return `${symbol}${fmt(value, 2)}`;
  }

  function formatPnl(value: number) {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${fmtCurrency(value, currency)}`;
  }

  return (
    <section className="glass-panel overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] px-6 py-5">
        <div>
          <p className="eyebrow">Execution Log</p>
          <h3 className="mt-2 text-2xl font-semibold text-[color:var(--ink-strong)]">Trade table</h3>
        </div>
        <div className="flex items-center gap-3 text-sm text-[color:var(--ink-muted)]">
          <span className="text-emerald-200">{trades.filter((trade) => trade.pnl > 0).length} wins</span>
          <span className="text-[color:var(--ink-soft)]">/</span>
          <span className="text-rose-200">{trades.filter((trade) => trade.pnl <= 0).length} losses</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.08] bg-white/[0.03]">
              {["#", "Ticker", "Side", "Entry Date", "Entry Price", "Exit Date", "Exit Price", "P&L", "P&L %", "Hold", "Exit Reason"].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((trade, index) => (
              <tr key={`${trade.ticker}-${trade.entry_date}-${index}`} className="border-b border-white/[0.06] last:border-b-0">
                <td className="px-4 py-3 text-[color:var(--ink-soft)]">{page * PAGE_SIZE + index + 1}</td>
                <td className="px-4 py-3 font-medium text-[color:var(--ink-strong)]">{trade.ticker}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.22em] ${
                      trade.side === "long"
                        ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100"
                        : "border-rose-300/40 bg-rose-500/10 text-rose-100"
                    }`}
                  >
                    {trade.side}
                  </span>
                </td>
                <td className="mono px-4 py-3 text-[color:var(--ink-muted)]">{trade.entry_date.split(" ")[0]}</td>
                <td className="mono px-4 py-3 text-[color:var(--ink-strong)]">{formatPrice(trade.entry_price)}</td>
                <td className="mono px-4 py-3 text-[color:var(--ink-muted)]">{trade.exit_date.split(" ")[0]}</td>
                <td className="mono px-4 py-3 text-[color:var(--ink-strong)]">{formatPrice(trade.exit_price)}</td>
                <td className={`mono px-4 py-3 font-medium ${trade.pnl >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                  {formatPnl(trade.pnl)}
                </td>
                <td className={`mono px-4 py-3 font-medium ${trade.pnl_percent >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                  {trade.pnl_percent >= 0 ? "+" : ""}
                  {fmt(trade.pnl_percent, 1)}%
                </td>
                <td className="mono px-4 py-3 text-[color:var(--ink-muted)]">{trade.holding_bars}d</td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">
                    {EXIT_LABELS[trade.exit_reason] ?? trade.exit_reason}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-white/[0.08] px-6 py-4">
          <button
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={page === 0}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--ink-muted)] transition hover:border-white/20 hover:text-[color:var(--ink-strong)] disabled:opacity-35"
          >
            Prev
          </button>
          <span className="text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
            Page {page + 1} of {pages}
          </span>
          <button
            onClick={() => setPage((current) => Math.min(pages - 1, current + 1))}
            disabled={page === pages - 1}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--ink-muted)] transition hover:border-white/20 hover:text-[color:var(--ink-strong)] disabled:opacity-35"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
