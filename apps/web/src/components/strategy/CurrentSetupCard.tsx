"use client";

export interface TickerSetup {
  ticker: string;
  price: number;
  currency: string;
  trend: "bullish" | "bearish" | "sideways";
  above_ema200: boolean | null;
  return_1m: number | null;
  pe_ratio: number | null;
}

function getSetupStatus(s: TickerSetup): { label: string; color: string; skip: boolean } {
  if (s.trend === "bearish" && s.above_ema200 === false)
    return { label: "Skip — downtrend", color: "text-red-400", skip: true };
  if (s.return_1m != null && s.return_1m > 15 && s.trend === "bullish")
    return { label: "Extended — wait for pullback", color: "text-amber-400", skip: false };
  if (s.above_ema200 === false && s.trend === "sideways")
    return { label: "Watch — testing support", color: "text-amber-400", skip: false };
  if (s.trend === "bullish" && s.above_ema200 === true)
    return { label: "In setup ✓", color: "text-emerald-400", skip: false };
  return { label: "Watch", color: "text-gray-400", skip: false };
}

interface Props {
  tickers: TickerSetup[];
  stopPct: number;
  targetPct: number;
}

export function CurrentSetupCard({ tickers, stopPct, targetPct }: Props) {
  if (!tickers.length) return null;
  const currency = tickers[0]?.currency ?? "USD";
  const symbol = currency === "INR" ? "₹" : "$";
  const rr = stopPct > 0 ? (targetPct / stopPct).toFixed(1) : "—";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111118] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-100">Current Setup</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Entry · stop · target based on live prices and strategy risk rules
          </p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <span className="rounded bg-white/5 border border-white/10 px-2 py-1">
            Stop {stopPct}% · Target {targetPct}% · R:R 1:{rr}
          </span>
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-4 gap-3 px-5 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-600 border-b border-white/[0.04]">
        <span>Ticker</span>
        <span>Entry (now)</span>
        <span className="text-red-500">Stop loss</span>
        <span className="text-emerald-600">Target</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/[0.03]">
        {tickers.map((s) => {
          const stopPrice  = s.price * (1 - stopPct  / 100);
          const targetPrice = s.price * (1 + targetPct / 100);
          const { label, color, skip } = getSetupStatus(s);
          const fmt = (n: number) =>
            symbol + n.toLocaleString(undefined, { maximumFractionDigits: currency === "INR" ? 0 : 2 });

          return (
            <div
              key={s.ticker}
              className={`grid grid-cols-4 gap-3 px-5 py-3 text-sm items-center transition-colors hover:bg-white/[0.02] ${skip ? "opacity-40" : ""}`}
            >
              {/* Ticker + status */}
              <div>
                <p className="font-semibold text-white text-xs">
                  {s.ticker.replace(".NS", "")}
                </p>
                {s.pe_ratio != null && (
                  <p className="text-[10px] text-gray-600">P/E {s.pe_ratio}</p>
                )}
                <p className={`text-[10px] mt-0.5 font-medium ${color}`}>{label}</p>
              </div>

              {/* Entry */}
              <div>
                <p className="font-semibold text-gray-100">{fmt(s.price)}</p>
                {s.return_1m != null && (
                  <p className={`text-[10px] ${s.return_1m >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {s.return_1m >= 0 ? "+" : ""}{s.return_1m.toFixed(1)}% 1M
                  </p>
                )}
              </div>

              {/* Stop */}
              <div>
                <p className="font-semibold text-red-400">{fmt(stopPrice)}</p>
                <p className="text-[10px] text-gray-600">−{stopPct}%</p>
              </div>

              {/* Target */}
              <div>
                <p className="font-semibold text-emerald-400">{fmt(targetPrice)}</p>
                <p className="text-[10px] text-gray-600">+{targetPct}%</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-white/[0.04] bg-white/[0.01]">
        <p className="text-[10px] text-gray-600">
          Prices are indicative based on latest screener data, not real-time quotes. For educational purposes only — not financial advice.
        </p>
      </div>
    </div>
  );
}
