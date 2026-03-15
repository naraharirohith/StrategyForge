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
  momentum: "bg-blue-50 text-blue-700 border-blue-200",
  mean_reversion: "bg-purple-50 text-purple-700 border-purple-200",
  swing: "bg-indigo-50 text-indigo-700 border-indigo-200",
  positional: "bg-teal-50 text-teal-700 border-teal-200",
  intraday: "bg-orange-50 text-orange-700 border-orange-200",
  portfolio: "bg-green-50 text-green-700 border-green-200",
  hybrid: "bg-slate-100 text-slate-700 border-slate-200",
};

const RISK_COLORS: Record<string, string> = {
  conservative: "bg-green-50 text-green-700 border-green-200",
  moderate: "bg-yellow-50 text-yellow-700 border-yellow-200",
  aggressive: "bg-red-50 text-red-700 border-red-200",
};

const EXIT_TYPE_LABELS: Record<string, string> = {
  stop_loss: "Stop Loss",
  take_profit: "Take Profit",
  trailing_stop: "Trailing Stop",
  time_based: "Time Exit",
  indicator_based: "Signal Exit",
  break_even: "Break Even",
};

export function StrategyCard({ strategy, onRunBacktest, loading }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900">{strategy.name}</h2>
            <p className="mt-1 text-sm text-slate-500 leading-relaxed">{strategy.description}</p>
          </div>
          <button
            onClick={onRunBacktest}
            disabled={loading}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Running…" : "Run Backtest"}
          </button>
        </div>

        {/* Badges */}
        <div className="mt-3 flex flex-wrap gap-2">
          {strategy.style && (
            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STYLE_COLORS[strategy.style] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
              {strategy.style.replace(/_/g, " ")}
            </span>
          )}
          {strategy.risk_level && (
            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${RISK_COLORS[strategy.risk_level] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
              {strategy.risk_level} risk
            </span>
          )}
          {strategy.timeframe && (
            <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
              {strategy.timeframe} chart
            </span>
          )}
          {strategy.universe && (
            <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
              {strategy.universe.market} {strategy.universe.asset_class}
            </span>
          )}
          {strategy.universe?.tickers && strategy.universe.tickers.length > 0 && (
            <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-mono text-slate-600">
              {strategy.universe.tickers.slice(0, 4).join(", ")}
              {strategy.universe.tickers.length > 4 && ` +${strategy.universe.tickers.length - 4}`}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {/* Indicators */}
        <div className="px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Indicators</p>
          <div className="flex flex-wrap gap-1.5">
            {(strategy.indicators ?? []).map((ind) => (
              <span
                key={ind.id}
                className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700"
                title={JSON.stringify(ind.params)}
              >
                {ind.type}
                {ind.params.period ? `(${ind.params.period})` : ""}
              </span>
            ))}
          </div>
        </div>

        {/* Entry Rules */}
        <div className="px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Entry Rules</p>
          <div className="space-y-1">
            {(strategy.entry_rules ?? []).map((rule) => (
              <div key={rule.id} className="flex items-center gap-1.5 text-xs">
                <span className={`rounded px-1.5 py-0.5 font-medium ${rule.side === "long" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {rule.side}
                </span>
                <span className="text-slate-700">{rule.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Exit Rules */}
        <div className="px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Exit Rules</p>
          <div className="space-y-1">
            {(strategy.exit_rules ?? []).map((rule) => (
              <div key={rule.id} className="flex items-center gap-1.5 text-xs">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                  {EXIT_TYPE_LABELS[rule.type] ?? rule.type}
                  {rule.value != null ? ` ${rule.value}%` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
