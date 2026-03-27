"use client";

import { useEffect, useState } from "react";
import { getStrategies } from "@/lib/api";
import { fmt } from "@/lib/utils";

type AnyObj = Record<string, unknown>;

interface MetricDef {
  label: string;
  key: string;
  format: (v: unknown) => string;
  /** Higher is better? Used to determine which column gets the green highlight. */
  higherIsBetter: boolean;
}

const METRICS: MetricDef[] = [
  {
    label: "Score",
    key: "score",
    format: (v) => (v != null ? `${fmt(v as number, 1)}/100` : "\u2014"),
    higherIsBetter: true,
  },
  {
    label: "Total Return",
    key: "totalReturn",
    format: (v) =>
      v != null
        ? `${(v as number) >= 0 ? "+" : ""}${fmt(v as number, 2)}%`
        : "\u2014",
    higherIsBetter: true,
  },
  {
    label: "Sharpe Ratio",
    key: "sharpeRatio",
    format: (v) => (v != null ? fmt(v as number, 2) : "\u2014"),
    higherIsBetter: true,
  },
  {
    label: "Max Drawdown",
    key: "maxDrawdown",
    format: (v) => (v != null ? `${fmt(v as number, 2)}%` : "\u2014"),
    higherIsBetter: false,
  },
  {
    label: "Win Rate",
    key: "winRate",
    format: (v) => (v != null ? `${fmt(v as number, 1)}%` : "\u2014"),
    higherIsBetter: true,
  },
  {
    label: "Profit Factor",
    key: "profitFactor",
    format: (v) => (v != null ? fmt(v as number, 2) : "\u2014"),
    higherIsBetter: true,
  },
  {
    label: "Total Trades",
    key: "totalTrades",
    format: (v) => (v != null ? String(v) : "\u2014"),
    higherIsBetter: true,
  },
  {
    label: "Style",
    key: "style",
    format: (v) =>
      v ? String(v).replace(/_/g, " ") : "\u2014",
    higherIsBetter: true, // not compared
  },
  {
    label: "Risk Level",
    key: "riskLevel",
    format: (v) => (v ? String(v) : "\u2014"),
    higherIsBetter: true, // not compared
  },
  {
    label: "Market",
    key: "market",
    format: (v) => (v ? String(v) : "\u2014"),
    higherIsBetter: true, // not compared
  },
];

/** Non-numeric metrics where "best" highlighting doesn't apply. */
const SKIP_HIGHLIGHT = new Set(["style", "riskLevel", "market"]);

function bestIndex(
  values: (unknown | null)[],
  higherIsBetter: boolean
): number | null {
  let bestIdx: number | null = null;
  let bestVal: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || typeof v !== "number") continue;
    if (
      bestVal == null ||
      (higherIsBetter ? v > bestVal : v < bestVal)
    ) {
      bestVal = v;
      bestIdx = i;
    }
  }
  // Only highlight if there are at least 2 numeric values to compare
  const numericCount = values.filter(
    (v) => v != null && typeof v === "number"
  ).length;
  return numericCount >= 2 ? bestIdx : null;
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
        setError(
          e instanceof Error ? e.message : "Failed to load strategies"
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function toggleStrategy(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((s) => s !== id)
        : [...prev, id].slice(0, 3)
    );
  }

  const selectedStrategies = strategies.filter((s) =>
    selected.includes(s.id as string)
  );

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-100">
            Compare Strategies
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Select 2-3 strategies to compare them side by side.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-sm text-gray-500">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
            Loading strategies...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Empty state — no strategies at all */}
        {!loading && !error && strategies.length === 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-[#111118] px-6 py-16 text-center">
            <p className="text-lg font-medium text-gray-300">
              No saved strategies yet.
            </p>
            <p className="mt-2 text-sm text-gray-400">
              Generate and backtest strategies first, then compare them
              here.
            </p>
            <a
              href="/"
              className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Go to Generator &rarr;
            </a>
          </div>
        )}

        {/* Strategy selector */}
        {!loading && strategies.length > 0 && (
          <>
            <div className="mb-6">
              <p className="mb-3 text-sm font-medium text-gray-300">
                Select strategies{" "}
                <span className="text-gray-500">
                  ({selected.length}/3)
                </span>
              </p>
              <div className="flex gap-3 flex-wrap">
                {strategies.map((s) => (
                  <button
                    key={s.id as string}
                    onClick={() => toggleStrategy(s.id as string)}
                    disabled={
                      !selected.includes(s.id as string) &&
                      selected.length >= 3
                    }
                    className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                      selected.includes(s.id as string)
                        ? "border-blue-500 bg-blue-500/15 text-blue-400 font-medium"
                        : "border-white/[0.06] bg-[#111118] text-gray-400 hover:border-white/10"
                    } disabled:opacity-30 disabled:cursor-not-allowed`}
                  >
                    {s.name as string}
                    {s.score != null && (
                      <span className="ml-2 text-xs text-gray-500">
                        {fmt(s.score as number, 0)}/100
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt to select more */}
            {selected.length < 2 && (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#111118] px-6 py-12 text-center">
                <p className="text-sm text-gray-400">
                  {selected.length === 0
                    ? "Select 2-3 strategies above to compare them side by side."
                    : "Select at least one more strategy to start comparing."}
                </p>
              </div>
            )}

            {/* Comparison table */}
            {selected.length >= 2 && (
              <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#111118]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-transparent">
                      <th className="px-4 py-3 text-left font-medium text-gray-400 whitespace-nowrap min-w-[100px]">
                        Metric
                      </th>
                      {selectedStrategies.map((s) => (
                        <th
                          key={s.id as string}
                          className="px-4 py-3 text-left font-medium text-gray-100 whitespace-nowrap min-w-[120px]"
                        >
                          {s.name as string}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {METRICS.map((metric) => {
                      const values = selectedStrategies.map(
                        (s) => s[metric.key]
                      );
                      const best = SKIP_HIGHLIGHT.has(metric.key)
                        ? null
                        : bestIndex(values, metric.higherIsBetter);

                      return (
                        <tr
                          key={metric.key}
                          className="border-b border-white/[0.06] last:border-b-0"
                        >
                          <td className="px-4 py-3 font-medium text-gray-400 whitespace-nowrap">
                            {metric.label}
                          </td>
                          {selectedStrategies.map((s, idx) => (
                            <td
                              key={s.id as string}
                              className={`px-4 py-3 text-gray-100 whitespace-nowrap ${
                                best === idx ? "bg-green-500/10 font-medium" : ""
                              }`}
                            >
                              {metric.format(s[metric.key])}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <p className="mt-8 text-center text-xs text-gray-500">
          For educational purposes only. Not investment advice.
        </p>
      </div>
    </div>
  );
}
