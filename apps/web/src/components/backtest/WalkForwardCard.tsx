"use client";

interface WalkForwardResult {
  in_sample_score: number;
  out_of_sample_score: number;
  degradation_percent: number;
  overfitting_risk: "low" | "medium" | "high";
}

const RISK_STYLES: Record<string, { badge: string; label: string }> = {
  low:    { badge: "bg-green-500/15 border-green-500/20 text-green-400",  label: "Low Overfitting Risk" },
  medium: { badge: "bg-amber-500/15 border-amber-500/20 text-amber-400",  label: "Medium Overfitting Risk" },
  high:   { badge: "bg-red-500/15 border-red-500/20 text-red-400",         label: "High Overfitting Risk" },
};

export function WalkForwardCard({ result }: { result: WalkForwardResult }) {
  const { in_sample_score, out_of_sample_score, degradation_percent, overfitting_risk } = result;
  const style = RISK_STYLES[overfitting_risk] ?? RISK_STYLES.medium;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Walk-Forward Validation</p>
          <p className="text-[10px] text-gray-600 mt-0.5">70% in-sample → 30% out-of-sample test</p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${style.badge}`}>
          {style.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-[10px] text-gray-500 mb-1">In-Sample Score</p>
          <p className="text-2xl font-bold text-gray-100">{in_sample_score.toFixed(1)}</p>
          <p className="text-[10px] text-gray-600">training period</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 mb-1">Out-of-Sample Score</p>
          <p className={`text-2xl font-bold ${
            overfitting_risk === "low" ? "text-green-400" :
            overfitting_risk === "medium" ? "text-amber-400" : "text-red-400"
          }`}>
            {out_of_sample_score.toFixed(1)}
          </p>
          <p className="text-[10px] text-gray-600">unseen data</p>
        </div>
      </div>

      {/* Degradation bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
          <span>Score degradation</span>
          <span className={degradation_percent > 35 ? "text-red-400 font-medium" : degradation_percent > 15 ? "text-amber-400 font-medium" : "text-green-400 font-medium"}>
            -{degradation_percent.toFixed(1)}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.06]">
          <div
            className={`h-1.5 rounded-full transition-all ${
              degradation_percent <= 15 ? "bg-green-500" :
              degradation_percent <= 35 ? "bg-amber-500" : "bg-red-500"
            }`}
            style={{ width: `${Math.min(100, degradation_percent * 2)}%` }}
          />
        </div>
      </div>

      <p className="text-[10px] text-gray-600 leading-relaxed">
        {overfitting_risk === "low"
          ? "Strategy generalises well. The out-of-sample period produced similar results to the training period."
          : overfitting_risk === "medium"
          ? "Moderate degradation on unseen data. Results may not fully replicate in live markets."
          : "Significant score drop on unseen data. Strategy may be curve-fitted. Use smaller position sizes and validate further."}
      </p>
    </div>
  );
}
