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
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-700">
          Trade Log <span className="ml-1 text-slate-400 font-normal">({trades.length} trades)</span>
        </h3>
        <div className="flex gap-1 text-xs text-slate-500">
          <span className="mr-1 text-green-600 font-medium">
            {trades.filter((t) => t.pnl > 0).length}W
          </span>
          /
          <span className="ml-1 text-red-600 font-medium">
            {trades.filter((t) => t.pnl <= 0).length}L
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {["#", "Ticker", "Side", "Entry Date", "Entry Price", "Exit Date", "Exit Price", "P&L", "P&L %", "Hold", "Exit Reason"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((t, i) => (
              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-400">{page * PAGE_SIZE + i + 1}</td>
                <td className="px-3 py-2 font-medium">{t.ticker}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 font-medium ${t.side === "long" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {t.side}
                  </span>
                </td>
                <td className="px-3 py-2 mono text-slate-600">{t.entry_date.split(" ")[0]}</td>
                <td className="px-3 py-2 mono">{fmtPrice(t.entry_price)}</td>
                <td className="px-3 py-2 mono text-slate-600">{t.exit_date.split(" ")[0]}</td>
                <td className="px-3 py-2 mono">{fmtPrice(t.exit_price)}</td>
                <td className={`px-3 py-2 mono font-medium ${t.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {fmtPnl(t.pnl)}
                </td>
                <td className={`px-3 py-2 mono font-medium ${t.pnl_percent >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {t.pnl_percent >= 0 ? "+" : ""}{fmt(t.pnl_percent, 1)}%
                </td>
                <td className="px-3 py-2 mono text-slate-500">{t.holding_bars}d</td>
                <td className="px-3 py-2">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                    {EXIT_LABELS[t.exit_reason] ?? t.exit_reason}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="text-xs text-slate-400">
            Page {page + 1} of {pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page === pages - 1}
            className="rounded px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
