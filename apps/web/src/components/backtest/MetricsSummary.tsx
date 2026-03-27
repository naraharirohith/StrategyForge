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

function Metric({
  label,
  value,
  sub,
  positive,
  featured = false,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  featured?: boolean;
}) {
  const tone =
    positive === true
      ? "text-emerald-200"
      : positive === false
        ? "text-rose-200"
        : "text-[color:var(--ink-strong)]";

  return (
    <div className={`metric-card ${featured ? "lg:col-span-2" : ""}`}>
      <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">{label}</p>
      <p className={`mono mt-3 text-3xl font-semibold ${tone}`}>{value}</p>
      {sub && <p className="mt-2 text-sm text-[color:var(--ink-muted)]">{sub}</p>}
    </div>
  );
}

export function MetricsSummary({ summary }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Performance Digest</p>
          <h3 className="section-title">What the backtest actually delivered</h3>
        </div>
        <p className="max-w-md text-right text-sm leading-6 text-[color:var(--ink-muted)]">
          These numbers balance edge, efficiency, and damage control so the strategy can be judged with more than a single return figure.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Total Return"
          value={fmtPct(summary.total_return_percent)}
          positive={summary.total_return_percent > 0}
          featured
        />
        <Metric
          label="Sharpe Ratio"
          value={fmt(summary.sharpe_ratio, 2)}
          positive={summary.sharpe_ratio > 1}
          featured
        />
        <Metric
          label="Max Drawdown"
          value={fmtPct(summary.max_drawdown_percent)}
          sub="Peak to trough loss"
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
        <Metric label="Average Hold" value={`${fmt(summary.avg_holding_bars, 0)} bars`} />
        <Metric label="Best Trade" value={fmtPct(summary.best_trade_percent)} positive />
        <Metric label="Worst Trade" value={fmtPct(summary.worst_trade_percent)} positive={false} />
        <Metric label="Annualized Volatility" value={`${fmt(summary.volatility_annual, 1)}%`} />
      </div>
    </section>
  );
}
