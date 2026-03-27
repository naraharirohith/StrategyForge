"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRightLeft, Layers3, Trophy } from "lucide-react";
import { getStrategies } from "@/lib/api";
import { fmt } from "@/lib/utils";

type AnyObj = Record<string, unknown>;

interface MetricDef {
  label: string;
  key: string;
  format: (v: unknown) => string;
  higherIsBetter: boolean;
}

const METRICS: MetricDef[] = [
  {
    label: "Score",
    key: "score",
    format: (v) => (v != null ? `${fmt(v as number, 1)}/100` : "-"),
    higherIsBetter: true,
  },
  {
    label: "Total Return",
    key: "totalReturn",
    format: (v) => (v != null ? `${(v as number) >= 0 ? "+" : ""}${fmt(v as number, 2)}%` : "-"),
    higherIsBetter: true,
  },
  {
    label: "Sharpe Ratio",
    key: "sharpeRatio",
    format: (v) => (v != null ? fmt(v as number, 2) : "-"),
    higherIsBetter: true,
  },
  {
    label: "Max Drawdown",
    key: "maxDrawdown",
    format: (v) => (v != null ? `${fmt(v as number, 2)}%` : "-"),
    higherIsBetter: false,
  },
  {
    label: "Win Rate",
    key: "winRate",
    format: (v) => (v != null ? `${fmt(v as number, 1)}%` : "-"),
    higherIsBetter: true,
  },
  {
    label: "Profit Factor",
    key: "profitFactor",
    format: (v) => (v != null ? fmt(v as number, 2) : "-"),
    higherIsBetter: true,
  },
  {
    label: "Total Trades",
    key: "totalTrades",
    format: (v) => (v != null ? String(v) : "-"),
    higherIsBetter: true,
  },
  {
    label: "Style",
    key: "style",
    format: (v) => (v ? String(v).replace(/_/g, " ") : "-"),
    higherIsBetter: true,
  },
  {
    label: "Risk Level",
    key: "riskLevel",
    format: (v) => (v ? String(v) : "-"),
    higherIsBetter: true,
  },
  {
    label: "Market",
    key: "market",
    format: (v) => (v ? String(v) : "-"),
    higherIsBetter: true,
  },
];

const SKIP_HIGHLIGHT = new Set(["style", "riskLevel", "market"]);

function bestIndex(values: (unknown | null)[], higherIsBetter: boolean): number | null {
  let bestIdx: number | null = null;
  let bestVal: number | null = null;

  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (value == null || typeof value !== "number") continue;

    if (bestVal == null || (higherIsBetter ? value > bestVal : value < bestVal)) {
      bestVal = value;
      bestIdx = index;
    }
  }

  const numericCount = values.filter((value) => value != null && typeof value === "number").length;
  return numericCount >= 2 ? bestIdx : null;
}

function CompareStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Layers3;
  label: string;
  value: string;
}) {
  return (
    <div className="soft-panel p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-[color:var(--ink-strong)]">{value}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.06] p-3 text-[color:var(--accent)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [strategies, setStrategies] = useState<AnyObj[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getStrategies();
        setStrategies(data.strategies ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load strategies");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  function toggleStrategy(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id].slice(0, 3)));
  }

  const selectedStrategies = strategies.filter((strategy) => selected.includes(strategy.id as string));
  const bestScore =
    strategies.reduce<number | null>((best, strategy) => {
      const value = typeof strategy.score === "number" ? (strategy.score as number) : null;
      if (value == null) return best;
      return best == null || value > best ? value : best;
    }, null) ?? null;

  return (
    <div className="page-shell">
      <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="glass-panel p-7 sm:p-8">
          <p className="eyebrow">Head-to-Head Analysis</p>
          <h1 className="display-title mt-3 max-w-3xl text-4xl sm:text-5xl">
            Stack your strongest systems side by side before you commit to one.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[color:var(--ink-muted)]">
            Compare no more than three strategies at once so the differences in edge, drawdown, and trading character stay legible.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard" className="nav-pill">
              Open strategy archive
            </Link>
            <Link href="/" className="stat-chip">
              Generate another candidate
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <CompareStat icon={Layers3} label="Available Systems" value={loading ? "..." : String(strategies.length)} />
          <CompareStat icon={ArrowRightLeft} label="Selected" value={String(selected.length)} />
          <CompareStat icon={Trophy} label="Top Score" value={bestScore != null ? fmt(bestScore, 0) : "-"} />
        </div>
      </section>

      {loading && (
        <section className="glass-panel px-6 py-14 text-center text-sm text-[color:var(--ink-soft)]">
          Loading strategies for comparison...
        </section>
      )}

      {error && (
        <section className="rounded-[28px] border border-rose-300/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          {error}
        </section>
      )}

      {!loading && !error && strategies.length === 0 && (
        <section className="glass-panel px-6 py-16 text-center">
          <p className="eyebrow">Nothing To Compare</p>
          <h2 className="mt-3 text-3xl font-semibold text-[color:var(--ink-strong)]">No saved strategies yet.</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[color:var(--ink-muted)]">
            Build and save a few backtested strategies first, then come back here to see which one deserves more attention.
          </p>
          <Link href="/" className="nav-pill mt-8 inline-flex">
            Go to generator
          </Link>
        </section>
      )}

      {!loading && strategies.length > 0 && (
        <>
          <section className="glass-panel p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">Selection</p>
                <h2 className="section-title">Choose two or three strategies</h2>
              </div>
              <p className="text-sm leading-6 text-[color:var(--ink-muted)]">
                {selected.length === 0
                  ? "Pick contenders to unlock the comparison table."
                  : `${selected.length} selected. Add up to ${Math.max(0, 3 - selected.length)} more.`}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {strategies.map((strategy) => {
                const id = strategy.id as string;
                const isSelected = selected.includes(id);

                return (
                  <button
                    key={id}
                    onClick={() => toggleStrategy(id)}
                    disabled={!isSelected && selected.length >= 3}
                    className={`rounded-full border px-4 py-2.5 text-sm transition ${
                      isSelected
                        ? "border-[color:var(--accent)] bg-[color:var(--accent)]/[0.15] text-[color:var(--ink-strong)] shadow-[0_10px_30px_rgba(234,174,88,0.14)]"
                        : "border-white/10 bg-white/5 text-[color:var(--ink-muted)] hover:border-white/20 hover:text-[color:var(--ink-strong)]"
                    } disabled:cursor-not-allowed disabled:opacity-35`}
                  >
                    {strategy.name as string}
                    {strategy.score != null && (
                      <span className="ml-3 mono text-xs text-[color:var(--ink-soft)]">{fmt(strategy.score as number, 0)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {selected.length < 2 && (
            <section className="glass-panel px-6 py-14 text-center">
              <p className="text-base text-[color:var(--ink-muted)]">
                {selected.length === 0
                  ? "Select at least two strategies to start the comparison."
                  : "Choose one more strategy to activate the comparison grid."}
              </p>
            </section>
          )}

          {selected.length >= 2 && (
            <>
              <section className="grid gap-4 lg:grid-cols-3">
                {selectedStrategies.map((strategy) => (
                  <article key={strategy.id as string} className="soft-panel p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">
                      {String(strategy.market ?? "Market")}
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold text-[color:var(--ink-strong)]">
                      {strategy.name as string}
                    </h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                        {String(strategy.style ?? "-").replace(/_/g, " ")}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                        {String(strategy.riskLevel ?? "-")}
                      </span>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[18px] border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">Score</p>
                        <p className="mono mt-2 text-2xl font-semibold text-[color:var(--ink-strong)]">
                          {strategy.score != null ? fmt(strategy.score as number, 1) : "-"}
                        </p>
                      </div>
                      <div className="rounded-[18px] border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">Return</p>
                        <p className={`mono mt-2 text-2xl font-semibold ${typeof strategy.totalReturn === "number" && (strategy.totalReturn as number) >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                          {strategy.totalReturn != null ? `${(strategy.totalReturn as number) >= 0 ? "+" : ""}${fmt(strategy.totalReturn as number, 2)}%` : "-"}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </section>

              <section className="glass-panel overflow-hidden">
                <div className="border-b border-white/[0.08] px-6 py-5">
                  <p className="eyebrow">Comparison Grid</p>
                  <h2 className="section-title">Metric-by-metric advantage map</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                        <th className="px-6 py-4 text-left text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">
                          Metric
                        </th>
                        {selectedStrategies.map((strategy) => (
                          <th
                            key={strategy.id as string}
                            className="px-6 py-4 text-left text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]"
                          >
                            {strategy.name as string}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {METRICS.map((metric) => {
                        const values = selectedStrategies.map((strategy) => strategy[metric.key]);
                        const best = SKIP_HIGHLIGHT.has(metric.key) ? null : bestIndex(values, metric.higherIsBetter);

                        return (
                          <tr key={metric.key} className="border-b border-white/[0.08] last:border-b-0">
                            <td className="px-6 py-4 font-medium text-[color:var(--ink-muted)]">{metric.label}</td>
                            {selectedStrategies.map((strategy, index) => (
                              <td
                                key={strategy.id as string}
                                className={`px-6 py-4 ${
                                  best === index
                                    ? "bg-emerald-500/10 font-semibold text-emerald-100"
                                    : "text-[color:var(--ink-strong)]"
                                }`}
                              >
                                {metric.format(strategy[metric.key])}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}

      <p className="pb-2 text-center text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">
        Educational use only. Not investment advice.
      </p>
    </div>
  );
}
