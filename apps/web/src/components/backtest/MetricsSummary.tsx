"use client";
import { fmtPct, fmt } from "@/lib/utils";

interface Summary {
  total_return_percent: number;
  sharpe_ratio: number;
  max_drawdown_percent: number;
  win_rate: number;
  profit_factor: number;
  total_trades: number;
  avg_holding_bars: number;
  best_trade_percent: number;
  worst_trade_percent: number;
  volatility_annual: number;
}

interface Props {
  summary: Summary;
}

function Metric({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  const color =
    positive === true ? "text-green-400" :
    positive === false ? "text-red-400" :
    "text-gray-100";
  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#111118] p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold mono ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export function MetricsSummary({ summary }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Metric
        label="Total Return"
        value={fmtPct(summary.total_return_percent)}
        positive={summary.total_return_percent > 0}
      />
      <Metric
        label="Sharpe Ratio"
        value={fmt(summary.sharpe_ratio, 2)}
        positive={summary.sharpe_ratio > 1}
      />
      <Metric
        label="Max Drawdown"
        value={fmtPct(summary.max_drawdown_percent)}
        sub="peak-to-trough"
        positive={false}
      />
      <Metric
        label="Win Rate"
        value={`${fmt(summary.win_rate, 1)}%`}
        positive={summary.win_rate > 50}
      />
      <Metric
        label="Profit Factor"
        value={fmt(summary.profit_factor, 2)}
        positive={summary.profit_factor > 1}
      />
      <Metric label="Total Trades" value={String(summary.total_trades)} />
      <Metric label="Avg Hold" value={`${fmt(summary.avg_holding_bars, 0)} bars`} />
      <Metric
        label="Best Trade"
        value={fmtPct(summary.best_trade_percent)}
        positive={true}
      />
      <Metric
        label="Worst Trade"
        value={fmtPct(summary.worst_trade_percent)}
        positive={false}
      />
      <Metric label="Annual Vol" value={`${fmt(summary.volatility_annual, 1)}%`} />
    </div>
  );
}
