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
  const sym = currencySymbol(currency);
  const fmtPrice = (n: number) => `${sym}${fmt(n, 2)}`;
  const fmtPnl = (n: number) => {
    const sign = n >= 0 ? "+" : "";
    return `${sign}${fmtCurrency(n, currency)}`;
  };
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;
  const pages = Math.ceil(trades.length / PAGE_SIZE);
  const visible = trades.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111118]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-300">
          Trade Log <span className="ml-1 text-gray-500 font-normal">({trades.length} trades)</span>
        </h3>
        <div className="flex gap-1 text-xs text-gray-400">
          <span className="mr-1 text-green-400 font-medium">
            {trades.filter((t) => t.pnl > 0).length}W
          </span>
          /
          <span className="ml-1 text-red-400 font-medium">
            {trades.filter((t) => t.pnl <= 0).length}L
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/5">
              {["#", "Ticker", "Side", "Entry Date", "Entry Price", "Exit Date", "Exit Price", "P&L", "P&L %", "Hold", "Exit Reason"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium text-gray-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((t, i) => (
              <tr key={i} className="border-b border-white/[0.03] hover:bg-white/5">
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{page * PAGE_SIZE + i + 1}</td>
                <td className="px-3 py-2 font-medium whitespace-nowrap">{t.ticker}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`rounded px-1.5 py-0.5 font-medium ${t.side === "long" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                    {t.side}
                  </span>
                </td>
                <td className="px-3 py-2 mono text-gray-400 whitespace-nowrap">{t.entry_date.split(" ")[0]}</td>
                <td className="px-3 py-2 mono whitespace-nowrap">{fmtPrice(t.entry_price)}</td>
                <td className="px-3 py-2 mono text-gray-400 whitespace-nowrap">{t.exit_date.split(" ")[0]}</td>
                <td className="px-3 py-2 mono whitespace-nowrap">{fmtPrice(t.exit_price)}</td>
                <td className={`px-3 py-2 mono font-medium whitespace-nowrap ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {fmtPnl(t.pnl)}
                </td>
                <td className={`px-3 py-2 mono font-medium whitespace-nowrap ${t.pnl_percent >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {t.pnl_percent >= 0 ? "+" : ""}{fmt(t.pnl_percent, 1)}%
                </td>
                <td className="px-3 py-2 mono text-gray-400 whitespace-nowrap">{t.holding_bars}d</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-gray-400">
                    {EXIT_LABELS[t.exit_reason] ?? t.exit_reason}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded px-3 py-1 text-xs text-gray-400 hover:bg-white/5 disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-500">
            Page {page + 1} of {pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page === pages - 1}
            className="rounded px-3 py-1 text-xs text-gray-400 hover:bg-white/5 disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
