"use client";

interface Indicator {
  id: string;
  type: string;
  params: Record<string, number | string>;
}

interface EntryRule {
  id: string;
  name: string;
  side: string;
}

interface ExitRule {
  id: string;
  name: string;
  type: string;
  value?: number;
}

interface Universe {
  market: string;
  asset_class: string;
  tickers?: string[];
}

interface Strategy {
  name: string;
  description: string;
  style: string;
  risk_level: string;
  timeframe: string;
  universe: Universe;
  indicators: Indicator[];
  entry_rules: EntryRule[];
  exit_rules: ExitRule[];
}

interface Props {
  strategy: Strategy;
  onRunBacktest: () => void;
  loading: boolean;
}

const STYLE_COLORS: Record<string, string> = {
  momentum: "border-cyan-300/40 bg-cyan-500/10 text-cyan-100",
  mean_reversion: "border-fuchsia-300/40 bg-fuchsia-500/10 text-fuchsia-100",
  swing: "border-indigo-300/40 bg-indigo-500/10 text-indigo-100",
  positional: "border-teal-300/40 bg-teal-500/10 text-teal-100",
  intraday: "border-orange-300/40 bg-orange-500/10 text-orange-100",
  portfolio: "border-emerald-300/40 bg-emerald-500/10 text-emerald-100",
  hybrid: "border-white/10 bg-white/5 text-[color:var(--ink-muted)]",
};

const RISK_COLORS: Record<string, string> = {
  conservative: "border-emerald-300/40 bg-emerald-500/10 text-emerald-100",
  moderate: "border-amber-300/40 bg-amber-500/10 text-amber-100",
  aggressive: "border-rose-300/40 bg-rose-500/10 text-rose-100",
};

const EXIT_TYPE_LABELS: Record<string, string> = {
  stop_loss: "Stop Loss",
  take_profit: "Take Profit",
  trailing_stop: "Trailing Stop",
  time_based: "Time Exit",
  indicator: "Indicator Exit",
  indicator_based: "Indicator Exit",
  break_even: "Break Even",
};

function SectionTitle({ label }: { label: string }) {
  return <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">{label}</p>;
}

export function StrategyCard({ strategy, onRunBacktest, loading }: Props) {
  return (
    <section className="glass-panel overflow-hidden">
      <div className="border-b border-white/[0.08] px-6 py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="eyebrow">Generated Strategy</p>
            <h2 className="mt-3 text-3xl font-semibold text-[color:var(--ink-strong)]">{strategy.name}</h2>
            <p className="mt-4 text-sm leading-7 text-[color:var(--ink-muted)]">{strategy.description}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {strategy.style && (
                <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${STYLE_COLORS[strategy.style] ?? STYLE_COLORS.hybrid}`}>
                  {strategy.style.replace(/_/g, " ")}
                </span>
              )}
              {strategy.risk_level && (
                <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${RISK_COLORS[strategy.risk_level] ?? STYLE_COLORS.hybrid}`}>
                  {strategy.risk_level} risk
                </span>
              )}
              {strategy.timeframe && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                  {strategy.timeframe} chart
                </span>
              )}
              {strategy.universe && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                  {strategy.universe.market} {strategy.universe.asset_class}
                </span>
              )}
            </div>
          </div>

          <div className="w-full max-w-xs rounded-[26px] border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">Next Step</p>
            <p className="mt-3 text-sm leading-6 text-[color:var(--ink-muted)]">
              Run a full backtest to score the system, inspect drawdown behavior, and produce the trade log.
            </p>
            <button
              onClick={onRunBacktest}
              disabled={loading}
              className="mt-5 w-full rounded-full bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-[color:var(--bg)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Running backtest..." : "Run Backtest"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-6 py-6 lg:grid-cols-3">
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <SectionTitle label="Indicators" />
          <div className="flex flex-wrap gap-2">
            {(strategy.indicators ?? []).map((indicator) => (
              <span
                key={indicator.id}
                className="mono rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[color:var(--ink-muted)]"
                title={JSON.stringify(indicator.params)}
              >
                {indicator.type}
                {indicator.params.period ? `(${indicator.params.period})` : ""}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <SectionTitle label="Entry Architecture" />
          <div className="space-y-2">
            {(strategy.entry_rules ?? []).map((rule) => (
              <div key={rule.id} className="rounded-[18px] border border-white/[0.08] bg-[color:var(--bg-strong)]/[0.50] px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] ${
                      rule.side === "long"
                        ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100"
                        : "border-rose-300/40 bg-rose-500/10 text-rose-100"
                    }`}
                  >
                    {rule.side}
                  </span>
                  <span className="text-sm font-medium text-[color:var(--ink-strong)]">{rule.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <SectionTitle label="Exit Architecture" />
          <div className="space-y-2">
            {(strategy.exit_rules ?? []).map((rule) => (
              <div key={rule.id} className="rounded-[18px] border border-white/[0.08] bg-[color:var(--bg-strong)]/[0.50] px-3 py-3">
                <span className="text-sm font-medium text-[color:var(--ink-strong)]">
                  {EXIT_TYPE_LABELS[rule.type] ?? rule.type}
                </span>
                {rule.value != null && (
                  <span className="ml-2 text-sm text-[color:var(--ink-muted)]">{rule.value}%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {strategy.universe?.tickers && strategy.universe.tickers.length > 0 && (
        <div className="border-t border-white/[0.08] px-6 py-5">
          <SectionTitle label="Universe Preview" />
          <div className="flex flex-wrap gap-2">
            {strategy.universe.tickers.map((ticker) => (
              <span
                key={ticker}
                className="mono rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[color:var(--ink-muted)]"
              >
                {ticker}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
