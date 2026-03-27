"use client";

import { useEffect, useState } from "react";
import { getStrategies, deleteStrategy } from "@/lib/api";
import { fmtDate, gradeColor, fmt } from "@/lib/utils";
import { CardSkeleton } from "@/components/Skeleton";

type AnyObj = Record<string, unknown>;

const STYLE_COLORS: Record<string, string> = {
  momentum: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  mean_reversion: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  swing: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  positional: "bg-teal-500/15 text-teal-400 border-teal-500/20",
  intraday: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  portfolio: "bg-green-500/15 text-green-400 border-green-500/20",
  hybrid: "bg-white/[0.06] text-gray-300 border-white/[0.06]",
};

const RISK_COLORS: Record<string, string> = {
  conservative: "bg-green-500/15 text-green-400 border-green-500/20",
  moderate: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  aggressive: "bg-red-500/15 text-red-400 border-red-500/20",
};

export default function DashboardPage() {
  const [strategies, setStrategies] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this strategy? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await deleteStrategy(id);
      setStrategies((prev) => prev.filter((s) => (s.id as string) !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete strategy");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-100">My Strategies</h1>
          {!loading && strategies.length > 0 && (
            <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-blue-400">
              {strategies.length}
            </span>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && strategies.length === 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-[#111118] px-6 py-16 text-center">
            <p className="text-lg font-medium text-gray-300">No strategies yet.</p>
            <p className="mt-2 text-sm text-gray-400">
              <a href="/" className="text-blue-600 hover:text-blue-700 font-medium">
                Generate your first strategy &rarr;
              </a>
            </p>
          </div>
        )}

        {/* Strategy grid */}
        {!loading && strategies.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {strategies.map((s) => {
              const style = (s.style as string) ?? "";
              const risk = (s.riskLevel as string) ?? "";
              const market = (s.market as string) ?? "";
              const score = s.score as number | null;
              const grade = s.grade as string | null;
              const totalReturn = s.totalReturn as number | null;

              return (
                <div
                  key={s.id as string}
                  className="rounded-2xl border border-white/[0.06] bg-[#111118] p-5 hover:border-blue-500/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-100 truncate">
                        {s.name as string}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {market && (
                          <span className="inline-flex items-center rounded border border-white/[0.06] bg-transparent px-2 py-0.5 text-xs text-gray-400">
                            {market}
                          </span>
                        )}
                        {style && (
                          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STYLE_COLORS[style] ?? "bg-white/[0.06] text-gray-400 border-white/[0.06]"}`}>
                            {style.replace(/_/g, " ")}
                          </span>
                        )}
                        {risk && (
                          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${RISK_COLORS[risk] ?? "bg-white/[0.06] text-gray-400 border-white/[0.06]"}`}>
                            {risk} risk
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {score != null ? (
                        <div>
                          <p className="text-3xl font-bold text-gray-100">{fmt(score, 0)}</p>
                          {grade && (
                            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-bold ${gradeColor(grade)}`}>
                              Grade {grade}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Not scored</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {totalReturn != null ? (
                        <span className={totalReturn >= 0 ? "text-green-400 font-medium" : "text-red-400 font-medium"}>
                          {totalReturn >= 0 ? "+" : ""}{fmt(totalReturn, 2)}%
                        </span>
                      ) : (
                        <span>&mdash;</span>
                      )}
                      <span>{fmtDate(s.createdAt as string)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleDelete(s.id as string)}
                        disabled={deleting === (s.id as string)}
                        className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        {deleting === (s.id as string) ? "Deleting..." : "Delete"}
                      </button>
                      <a
                        href={`/strategy/${s.id as string}`}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        View Details &rarr;
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-gray-500">
          For educational purposes only. Not investment advice.
        </p>
      </div>
    </div>
  );
}
