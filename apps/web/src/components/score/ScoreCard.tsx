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
    <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">Strategy Score</p>
          <p className={`mt-1 text-5xl font-bold mono ${scoreColor(score.overall)}`}>
            {fmt(score.overall, 1)}
          </p>
          <div className="mt-2 flex gap-2">
            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-sm font-bold ${gradeColor(score.grade)}`}>
              Grade {score.grade}
            </span>
            {score.verified && (
              <span className="inline-flex items-center rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">
                ✓ Verified
              </span>
            )}
            {score.publishable && !score.verified && (
              <span className="inline-flex items-center rounded border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
                Publishable
              </span>
            )}
          </div>
        </div>
        <div className="relative h-20 w-20">
          <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke={score.overall >= 70 ? "#16a34a" : score.overall >= 40 ? "#d97706" : "#dc2626"}
              strokeWidth="3"
              strokeDasharray={`${score.overall} 100`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-300">
            {Math.round(score.overall)}
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {Object.entries(score.breakdown).map(([key, val]) => (
          <div key={key}>
            <div className="flex justify-between text-xs text-gray-400 mb-0.5">
              <span>{LABELS[key] ?? key}</span>
              <span className="mono">{fmt(val.score, 0)}/100</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/[0.06]">
              <div
                className="h-1.5 rounded-full bg-blue-500"
                style={{ width: `${val.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
