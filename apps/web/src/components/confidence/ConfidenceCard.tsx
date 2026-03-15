"use client";

interface Component {
  score: number;
  weight: number;
  description: string;
  current_regime?: string;
  preferred_regime?: string;
  triggered?: boolean;
  level?: string;
  india_vix?: number | null;
  us_vix?: number | null;
}

interface GlobalRisk {
  sp500_5d_return?: number;
  sp500_trend?: string;
  crude_5d_return?: number;
  crude_trend?: string;
  usdinr_5d_change?: number;
  inr_pressure?: string;
}

interface Confidence {
  overall: number;
  recommendation: string;
  recommendation_label: string;
  reasoning: string;
  components: {
    backtest_strength: Component;
    regime_fit: Component;
    signal_proximity: Component & { triggered?: boolean };
    volatility_context: Component;
  };
  global_risk: GlobalRisk;
}

const REGIME_COLORS: Record<string, string> = {
  bull:     "bg-green-100 text-green-700",
  bear:     "bg-red-100 text-red-700",
  sideways: "bg-yellow-100 text-yellow-700",
  unknown:  "bg-slate-100 text-slate-500",
};

const REC_COLORS: Record<string, string> = {
  buy:    "bg-green-600",
  hold:   "bg-yellow-500",
  reduce: "bg-orange-500",
  exit:   "bg-red-600",
};

const VOL_COLORS: Record<string, string> = {
  low:      "text-green-600",
  normal:   "text-slate-600",
  elevated: "text-orange-600",
  extreme:  "text-red-600",
};

function ComponentRow({ label, score, weight, description }: {
  label: string; score: number; weight: number; description: string;
}) {
  const pct = Math.round(weight * 100);
  const fill = Math.round(score);
  const color = score >= 70 ? "bg-green-500" : score >= 45 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-600">{label} <span className="text-slate-400">({pct}%)</span></span>
        <span className="text-xs font-semibold text-slate-700">{Math.round(score)}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${fill}%` }} />
      </div>
      <p className="mt-0.5 text-xs text-slate-400 leading-tight">{description}</p>
    </div>
  );
}

export function ConfidenceCard({ confidence }: { confidence: Confidence }) {
  const { overall, recommendation, recommendation_label, reasoning, components, global_risk } = confidence;
  const regime = components.regime_fit.current_regime ?? "unknown";
  const recColor = REC_COLORS[recommendation] ?? "bg-slate-500";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Live Confidence</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900">{Math.round(overall)}</span>
              <span className="text-slate-400 text-sm">/ 100</span>
            </div>
          </div>
          <div className="text-right space-y-1.5">
            <span className={`inline-block rounded-lg px-3 py-1 text-xs font-semibold text-white ${recColor}`}>
              {recommendation_label}
            </span>
            <div>
              <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${REGIME_COLORS[regime]}`}>
                {regime} market
              </span>
            </div>
          </div>
        </div>

        {/* Signal active banner */}
        {components.signal_proximity.triggered && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-green-700">Entry signal is active right now</span>
          </div>
        )}
      </div>

      {/* Reasoning */}
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
        <p className="text-xs text-slate-600 leading-relaxed">{reasoning}</p>
      </div>

      {/* Score breakdown */}
      <div className="px-5 py-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Score Breakdown</p>
        <ComponentRow
          label="Backtest Strength"
          score={components.backtest_strength.score}
          weight={components.backtest_strength.weight}
          description={components.backtest_strength.description}
        />
        <ComponentRow
          label="Regime Fit"
          score={components.regime_fit.score}
          weight={components.regime_fit.weight}
          description={components.regime_fit.description}
        />
        <ComponentRow
          label="Signal Proximity"
          score={components.signal_proximity.score}
          weight={components.signal_proximity.weight}
          description={components.signal_proximity.description}
        />
        <ComponentRow
          label="Volatility Context"
          score={components.volatility_context.score}
          weight={components.volatility_context.weight}
          description={components.volatility_context.description}
        />
      </div>

      {/* Global risk */}
      {Object.keys(global_risk).length > 0 && (
        <div className="border-t border-slate-100 px-5 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Global Signals</p>
          <div className="flex flex-wrap gap-3">
            {global_risk.sp500_trend && (
              <div className="text-xs">
                <span className="text-slate-400">S&amp;P 500 (5d) </span>
                <span className={global_risk.sp500_5d_return! >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                  {global_risk.sp500_5d_return! >= 0 ? "+" : ""}{global_risk.sp500_5d_return}%
                </span>
              </div>
            )}
            {global_risk.crude_trend && (
              <div className="text-xs">
                <span className="text-slate-400">Crude (5d) </span>
                <span className={global_risk.crude_5d_return! >= 0 ? "text-orange-600 font-medium" : "text-green-600 font-medium"}>
                  {global_risk.crude_5d_return! >= 0 ? "+" : ""}{global_risk.crude_5d_return}%
                </span>
              </div>
            )}
            {global_risk.inr_pressure && (
              <div className="text-xs">
                <span className="text-slate-400">INR </span>
                <span className={`font-medium ${global_risk.inr_pressure === "weakening" ? "text-red-600" : "text-green-600"}`}>
                  {global_risk.inr_pressure}
                </span>
              </div>
            )}
            {(components.volatility_context.india_vix || components.volatility_context.us_vix) && (
              <div className="text-xs">
                <span className="text-slate-400">{components.volatility_context.india_vix ? "India VIX" : "VIX"} </span>
                <span className={`font-medium ${VOL_COLORS[components.volatility_context.level ?? "normal"]}`}>
                  {components.volatility_context.india_vix ?? components.volatility_context.us_vix}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
