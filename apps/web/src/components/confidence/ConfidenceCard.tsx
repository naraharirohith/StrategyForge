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

const REGIME_STYLES: Record<string, string> = {
  bull: "border-emerald-300/70 bg-emerald-500/[0.12] text-emerald-100",
  bear: "border-rose-300/70 bg-rose-500/[0.12] text-rose-100",
  sideways: "border-amber-300/70 bg-amber-500/[0.12] text-amber-100",
  unknown: "border-white/[0.15] bg-white/[0.06] text-[color:var(--ink-soft)]",
};

const RECOMMENDATION_STYLES: Record<string, string> = {
  buy: "border-emerald-300/70 bg-emerald-500/[0.14] text-emerald-100",
  hold: "border-amber-300/70 bg-amber-500/[0.14] text-amber-100",
  reduce: "border-orange-300/70 bg-orange-500/[0.14] text-orange-100",
  exit: "border-rose-300/70 bg-rose-500/[0.14] text-rose-100",
};

const VOL_STYLES: Record<string, string> = {
  low: "text-emerald-200",
  normal: "text-[color:var(--ink-soft)]",
  elevated: "text-orange-200",
  extreme: "text-rose-200",
};

function ConfidenceGauge({ value }: { value: number }) {
  const score = Math.max(0, Math.min(100, Math.round(value)));
  const angle = score * 3.6;

  return (
    <div
      className="relative h-28 w-28 rounded-full border border-white/[0.12]"
      style={{
        background: `conic-gradient(from 180deg, var(--accent) 0deg ${angle}deg, rgba(255,255,255,0.08) ${angle}deg 360deg)`,
      }}
    >
      <div className="absolute inset-[10px] rounded-full border border-white/10 bg-[color:var(--bg-strong)]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="mono text-3xl font-semibold text-[color:var(--ink-strong)]">{score}</span>
        <span className="text-[10px] uppercase tracking-[0.32em] text-[color:var(--ink-soft)]">live</span>
      </div>
    </div>
  );
}

function BreakdownCard({
  label,
  score,
  weight,
  description,
}: {
  label: string;
  score: number;
  weight: number;
  description: string;
}) {
  const normalized = Math.max(0, Math.min(100, Math.round(score)));
  const tone =
    score >= 70
      ? "border-emerald-300/40 bg-emerald-500/[0.14] text-emerald-100"
      : score >= 45
        ? "border-amber-300/40 bg-amber-500/[0.14] text-amber-100"
        : "border-rose-300/40 bg-rose-500/[0.14] text-rose-100";

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-[color:var(--ink-strong)]">{normalized}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.26em] ${tone}`}>
          {Math.round(weight * 100)}%
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full ${tone.split(" ")[1]}`} style={{ width: `${normalized}%` }} />
      </div>
      <p className="mt-3 text-sm leading-6 text-[color:var(--ink-muted)]">{description}</p>
    </div>
  );
}

export function ConfidenceCard({ confidence }: { confidence: Confidence }) {
  const { overall, recommendation, recommendation_label, reasoning, components, global_risk } = confidence;
  const regime = components.regime_fit.current_regime ?? "unknown";
  const recStyle = RECOMMENDATION_STYLES[recommendation] ?? RECOMMENDATION_STYLES.hold;
  const regimeStyle = REGIME_STYLES[regime] ?? REGIME_STYLES.unknown;
  const volatilityValue = components.volatility_context.india_vix ?? components.volatility_context.us_vix;
  const globalSignals = [
    global_risk.sp500_trend
      ? {
          label: "S&P 500 (5d)",
          value: `${global_risk.sp500_5d_return! >= 0 ? "+" : ""}${global_risk.sp500_5d_return}%`,
          tone: global_risk.sp500_5d_return! >= 0 ? "text-emerald-200" : "text-rose-200",
        }
      : null,
    global_risk.crude_trend
      ? {
          label: "Crude (5d)",
          value: `${global_risk.crude_5d_return! >= 0 ? "+" : ""}${global_risk.crude_5d_return}%`,
          tone: global_risk.crude_5d_return! >= 0 ? "text-orange-200" : "text-emerald-200",
        }
      : null,
    global_risk.inr_pressure
      ? {
          label: "INR",
          value: global_risk.inr_pressure,
          tone: global_risk.inr_pressure === "weakening" ? "text-rose-200" : "text-emerald-200",
        }
      : null,
    volatilityValue
      ? {
          label: components.volatility_context.india_vix ? "India VIX" : "VIX",
          value: String(volatilityValue),
          tone: VOL_STYLES[components.volatility_context.level ?? "normal"],
        }
      : null,
  ].filter(Boolean) as { label: string; value: string; tone: string }[];

  return (
    <section className="glass-panel overflow-hidden">
      <div className="grid gap-6 border-b border-white/[0.08] px-6 py-6 lg:grid-cols-[auto,1fr]">
        <div className="flex items-center justify-center lg:justify-start">
          <ConfidenceGauge value={overall} />
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Live Confidence</p>
              <h3 className="mt-2 text-2xl font-semibold text-[color:var(--ink-strong)]">
                Market timing with context
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--ink-muted)]">{reasoning}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] ${recStyle}`}>
                {recommendation_label}
              </span>
              <span className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] ${regimeStyle}`}>
                {regime} regime
              </span>
            </div>
          </div>

          {components.signal_proximity.triggered && (
            <div className="flex items-center gap-3 rounded-[20px] border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)]" />
              Entry signal is currently active.
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">Signal State</p>
              <p className="mt-2 text-lg font-semibold text-[color:var(--ink-strong)]">
                {components.signal_proximity.triggered ? "Actionable now" : "Waiting for setup"}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">Preferred Regime</p>
              <p className="mt-2 text-lg font-semibold text-[color:var(--ink-strong)]">
                {components.regime_fit.preferred_regime ?? "Adaptive"}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">Volatility Context</p>
              <p className={`mt-2 text-lg font-semibold ${VOL_STYLES[components.volatility_context.level ?? "normal"]}`}>
                {components.volatility_context.level ?? "normal"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
        <BreakdownCard
          label="Backtest Strength"
          score={components.backtest_strength.score}
          weight={components.backtest_strength.weight}
          description={components.backtest_strength.description}
        />
        <BreakdownCard
          label="Regime Fit"
          score={components.regime_fit.score}
          weight={components.regime_fit.weight}
          description={components.regime_fit.description}
        />
        <BreakdownCard
          label="Signal Proximity"
          score={components.signal_proximity.score}
          weight={components.signal_proximity.weight}
          description={components.signal_proximity.description}
        />
        <BreakdownCard
          label="Volatility Context"
          score={components.volatility_context.score}
          weight={components.volatility_context.weight}
          description={components.volatility_context.description}
        />
      </div>

      {globalSignals.length > 0 && (
        <div className="border-t border-white/[0.08] px-6 py-5">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">Global Overlay</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {globalSignals.map((signal) => (
              <div key={signal.label} className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <span className="text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">{signal.label}</span>
                <span className={`ml-3 text-sm font-semibold ${signal.tone}`}>{signal.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
