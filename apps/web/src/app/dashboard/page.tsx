"use client";

import { useEffect, useState } from "react";
import { getStrategies } from "@/lib/api";
import { fmtDate, gradeColor, fmt } from "@/lib/utils";

type AnyObj = Record<string, unknown>;

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

export default function DashboardPage() {
  const [strategies, setStrategies] = useState<AnyObj[]>([]);
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">My Strategies</h1>
          {!loading && strategies.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              {strategies.length}
            </span>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-sm text-slate-400">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
            Loading strategies...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && strategies.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <p className="text-lg font-medium text-slate-700">No strategies yet.</p>
            <p className="mt-2 text-sm text-slate-500">
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
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-200 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-slate-900 truncate">
                        {s.name as string}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {market && (
                          <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                            {market}
                          </span>
                        )}
                        {style && (
                          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STYLE_COLORS[style] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {style.replace(/_/g, " ")}
                          </span>
                        )}
                        {risk && (
                          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${RISK_COLORS[risk] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {risk} risk
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {score != null ? (
                        <div>
                          <p className="text-3xl font-bold text-slate-900">{fmt(score, 0)}</p>
                          {grade && (
                            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-bold ${gradeColor(grade)}`}>
                              Grade {grade}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">Not scored</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {totalReturn != null ? (
                        <span className={totalReturn >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                          {totalReturn >= 0 ? "+" : ""}{fmt(totalReturn, 2)}%
                        </span>
                      ) : (
                        <span>&mdash;</span>
                      )}
                      <span>{fmtDate(s.createdAt as string)}</span>
                    </div>
                    <a
                      href={`/strategy/${s.id as string}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      View Details &rarr;
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          For educational purposes only. Not investment advice.
        </p>
      </div>
    </div>
  );
}
