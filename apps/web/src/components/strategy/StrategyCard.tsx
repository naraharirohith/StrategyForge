"use client";

interface AiMetadata {
  dynamic_universe?: boolean;
  universe_source?: string;
}

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
  ai_metadata?: AiMetadata;
}

interface Props {
  strategy: Strategy;
  onRunBacktest: () => void;
  loading: boolean;
}

const STYLE_COLORS: Record<string, string> = {
  momentum: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  mean_reversion: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  swing: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  positional: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  intraday: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  portfolio: "bg-green-500/10 text-green-400 border-green-500/20",
  hybrid: "bg-white/[0.06] text-gray-300 border-white/[0.06]",
};

const RISK_COLORS: Record<string, string> = {
  conservative: "bg-green-500/10 text-green-400 border-green-500/20",
  moderate: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  aggressive: "bg-red-500/10 text-red-400 border-red-500/20",
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
    <div className="rounded-2xl border border-white/[0.06] bg-[#111118]">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-100">{strategy.name}</h2>
            <p className="mt-1 text-sm text-gray-400 leading-relaxed">{strategy.description}</p>
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
            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STYLE_COLORS[strategy.style] ?? "bg-white/[0.06] text-gray-400 border-white/[0.06]"}`}>
              {strategy.style.replace(/_/g, " ")}
            </span>
          )}
          {strategy.risk_level && (
            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${RISK_COLORS[strategy.risk_level] ?? "bg-white/[0.06] text-gray-400 border-white/[0.06]"}`}>
              {strategy.risk_level} risk
            </span>
          )}
          {strategy.timeframe && (
            <span className="inline-flex items-center rounded border border-white/[0.06] bg-white/5 px-2 py-0.5 text-xs text-gray-400">
              {strategy.timeframe} chart
            </span>
          )}
          {strategy.universe && (
            <span className="inline-flex items-center rounded border border-white/[0.06] bg-white/5 px-2 py-0.5 text-xs text-gray-400">
              {strategy.universe.market} {strategy.universe.asset_class}
            </span>
          )}
          {strategy.ai_metadata?.dynamic_universe && (
            <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Live universe
            </span>
          )}
          {strategy.universe?.tickers && strategy.universe.tickers.length > 0 && (
            <span className="inline-flex items-center rounded border border-white/[0.06] bg-white/5 px-2 py-0.5 text-xs font-mono text-gray-400">
              {strategy.universe.tickers.slice(0, 4).join(", ")}
              {strategy.universe.tickers.length > 4 && ` +${strategy.universe.tickers.length - 4}`}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-white/[0.06] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {/* Indicators */}
        <div className="px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Indicators</p>
          <div className="flex flex-wrap gap-1.5">
            {(strategy.indicators ?? []).map((ind) => (
              <span
                key={ind.id}
                className="rounded bg-white/[0.06] px-2 py-0.5 text-xs font-mono text-gray-300"
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Entry Rules</p>
          <div className="space-y-1">
            {(strategy.entry_rules ?? []).map((rule, i) => (
              <div key={rule.id ?? i} className="flex items-center gap-1.5 text-xs">
                <span className={`rounded px-1.5 py-0.5 font-medium ${rule.side === "long" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                  {rule.side}
                </span>
                <span className="text-gray-300">{rule.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Exit Rules */}
        <div className="px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Exit Rules</p>
          <div className="space-y-1">
            {(strategy.exit_rules ?? []).map((rule, i) => (
              <div key={rule.id ?? i} className="flex items-center gap-1.5 text-xs">
                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-gray-400">
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
