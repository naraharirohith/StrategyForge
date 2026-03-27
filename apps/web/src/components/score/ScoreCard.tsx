"use client";

import { gradeColor, scoreColor, fmt } from "@/lib/utils";

interface Props {
  score: {
    overall: number;
    grade: string;
    publishable: boolean;
    verified: boolean;
    breakdown: Record<string, { value: number; score: number; weight: number }>;
  };
}

const LABELS: Record<string, string> = {
  sharpe_ratio: "Sharpe Ratio",
  max_drawdown: "Max Drawdown",
  win_rate: "Win Rate",
  profit_factor: "Profit Factor",
  consistency: "Consistency",
  regime_score: "Regime Score",
};

export function ScoreCard({ score }: Props) {
  return (
    <section className="glass-panel overflow-hidden">
      <div className="grid gap-6 border-b border-white/[0.08] px-6 py-6 lg:grid-cols-[1fr,auto]">
        <div>
          <p className="eyebrow">Strategy Score</p>
          <div className="mt-3 flex items-end gap-3">
            <span className={`mono text-6xl font-semibold ${scoreColor(score.overall)}`}>{fmt(score.overall, 1)}</span>
            <span className="pb-2 text-sm uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">out of 100</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold ${gradeColor(score.grade)}`}>
              Grade {score.grade}
            </span>
            {score.verified && (
              <span className="inline-flex items-center rounded-full border border-cyan-300/40 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-cyan-100">
                Verified
              </span>
            )}
            {score.publishable && !score.verified && (
              <span className="inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-emerald-100">
                Publishable
              </span>
            )}
          </div>
        </div>

        <div
          className="relative h-28 w-28 rounded-full border border-white/[0.12]"
          style={{
            background: `conic-gradient(from 180deg, var(--accent) 0deg ${Math.max(0, Math.min(100, score.overall)) * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
          }}
        >
          <div className="absolute inset-[10px] rounded-full border border-white/10 bg-[color:var(--bg-strong)]" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="mono text-3xl font-semibold text-[color:var(--ink-strong)]">{Math.round(score.overall)}</span>
            <span className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--ink-soft)]">score</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-6 py-6 sm:grid-cols-2">
        {Object.entries(score.breakdown).map(([key, value]) => (
          <div key={key} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">{LABELS[key] ?? key}</p>
                <p className="mono mt-2 text-2xl font-semibold text-[color:var(--ink-strong)]">{fmt(value.score, 0)}</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                {Math.round(value.weight * 100)}%
              </span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full bg-[color:var(--accent)]" style={{ width: `${value.score}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
