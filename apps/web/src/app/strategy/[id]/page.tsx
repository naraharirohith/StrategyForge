"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { getStrategy } from "@/lib/api";
import { ScoreCard } from "@/components/score/ScoreCard";
import { ConfidenceCard } from "@/components/confidence/ConfidenceCard";
import { MetricsSummary } from "@/components/backtest/MetricsSummary";
import { EquityCurve } from "@/components/backtest/EquityCurve";
import { DrawdownChart } from "@/components/backtest/DrawdownChart";
import { MonthlyReturns } from "@/components/backtest/MonthlyReturns";
import { TradeTable } from "@/components/backtest/TradeTable";
import { gradeColor, fmtDate } from "@/lib/utils";
import { CardSkeleton, ChartSkeleton } from "@/components/Skeleton";

type AnyObj = Record<string, unknown>;

const TABS = ["Overview", "Performance", "Trades", "Strategy Logic"] as const;
type Tab = (typeof TABS)[number];

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

const EXIT_TYPE_LABELS: Record<string, string> = {
  stop_loss: "Stop Loss",
  take_profit: "Take Profit",
  trailing_stop: "Trailing Stop",
  time_based: "Time Exit",
  indicator_based: "Signal Exit",
  break_even: "Break Even",
};

const OPERATOR_LABELS: Record<string, string> = {
  crosses_above: "crosses above",
  crosses_below: "crosses below",
  gt: ">",
  lt: "<",
  gte: ">=",
  lte: "<=",
  eq: "=",
};

export default function StrategyDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [tab, setTab] = useState<Tab>("Overview");
  const [strategy, setStrategy] = useState<AnyObj | null>(null);
  const [definition, setDefinition] = useState<AnyObj | null>(null);
  const [backtest, setBacktest] = useState<AnyObj | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);

  const loadStrategy = useCallback(async () => {
    try {
      // Try API first
      const data = await getStrategy(id);
      const strat = data.strategy as AnyObj;
      setStrategy(strat);
      setDefinition(strat.definition as AnyObj ?? null);

      // Check for backtest result
      const backtestRuns = strat.backtestRuns as AnyObj[] | undefined;
      if (backtestRuns && backtestRuns.length > 0) {
        setBacktest(backtestRuns[0].result as AnyObj ?? null);
      }
    } catch {
      // Fallback to localStorage
      try {
        const stored = localStorage.getItem(`strategy_${id}`);
        if (stored) {
          const parsed = JSON.parse(stored) as AnyObj;
          setStrategy(parsed);
          setDefinition(parsed.definition as AnyObj ?? parsed);
        } else {
          setError("Strategy not found");
        }
      } catch {
        setError("Strategy not found");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadStrategy();
  }, [loadStrategy]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-6">
          <CardSkeleton />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <a href="/" className="text-sm text-blue-600 hover:text-blue-700">&larr; Back to Generator</a>
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error || "Strategy not found"}
          </div>
        </div>
      </div>
    );
  }

  const def = definition ?? strategy;
  const name = (strategy.name as string) ?? (def.name as string) ?? "Untitled Strategy";
  const description = (strategy.description as string) ?? (def.description as string) ?? "";
  const style = (def.style as string) ?? (strategy.style as string) ?? "";
  const riskLevel = (def.risk_level as string) ?? (strategy.riskLevel as string) ?? "";
  const market = (def.universe as AnyObj)?.market as string ?? (strategy.market as string) ?? "";
  const timeframe = (def.timeframe as string) ?? (strategy.timeframe as string) ?? "";
  const indicators = (def.indicators as AnyObj[]) ?? [];
  const entryRules = (def.entry_rules as AnyObj[]) ?? [];
  const exitRules = (def.exit_rules as AnyObj[]) ?? [];
  const riskMgmt = (def.risk_management as AnyObj) ?? {};
  const backtestConfig = (def.backtest_config as AnyObj) ?? {};
  const initialCapital = (backtestConfig.initial_capital as number) ?? 100000;
  const currency = (backtestConfig.currency as string) ?? "USD";
  const score = backtest?.score as AnyObj | undefined;
  const backtestConfidence = backtest?.confidence as AnyObj | undefined;
  const strategyConfidence = strategy.confidenceData as AnyObj | undefined;
  const confidence = backtestConfidence ?? strategyConfidence ?? undefined;
  const confidenceUpdatedAt = strategy.confidenceUpdatedAt as string | undefined;
  const summary = backtest?.summary as AnyObj | undefined;
  const grade = (strategy.grade as string) ?? (score?.grade as string) ?? null;
  const createdAt = strategy.createdAt as string | undefined;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Navigation */}
        <a href="/" className="text-sm text-blue-600 hover:text-blue-700">&larr; Back to Generator</a>

        {/* Header */}
        <div className="mt-4 mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {style && (
              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STYLE_COLORS[style] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                {style.replace(/_/g, " ")}
              </span>
            )}
            {riskLevel && (
              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${RISK_COLORS[riskLevel] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                {riskLevel} risk
              </span>
            )}
            {market && (
              <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                {market}
              </span>
            )}
            {timeframe && (
              <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                {timeframe} chart
              </span>
            )}
            {grade && (
              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-bold ${gradeColor(grade)}`}>
                Grade {grade}
              </span>
            )}
            {createdAt && (
              <span className="inline-flex items-center text-xs text-slate-400">
                Created {fmtDate(createdAt)}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {tab === "Overview" && (
          <div className="space-y-6">
            {/* Score + Confidence */}
            {(score || confidence) && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {score && <ScoreCard score={score as any} />}
                {confidence && (
                  <div>
                    <ConfidenceCard confidence={confidence as any} />
                    {confidenceUpdatedAt && !backtestConfidence && (
                      <p className="mt-2 text-xs text-slate-400">
                        Last updated: {fmtDate(confidenceUpdatedAt)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Metrics */}
            {summary && (
              <MetricsSummary summary={summary as any} />
            )}

            {/* No backtest */}
            {!backtest && !confidence && (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
                <p className="text-sm text-slate-500">No backtest results available.</p>
                <p className="mt-1 text-xs text-slate-400">
                  Run a backtest from the{" "}
                  <a href="/" className="text-blue-600 hover:text-blue-700">Generator</a>
                  {" "}to see scores and metrics.
                </p>
              </div>
            )}
            {!backtest && confidence && (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
                <p className="text-sm text-slate-500">No backtest results yet. Showing persisted confidence score above.</p>
                <p className="mt-1 text-xs text-slate-400">
                  Run a backtest from the{" "}
                  <a href="/" className="text-blue-600 hover:text-blue-700">Generator</a>
                  {" "}to see full scores and metrics.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Performance */}
        {tab === "Performance" && (
          <div className="space-y-6">
            {backtest ? (
              <>
                {backtest.equity_curve && (
                  <EquityCurve
                    equityCurve={backtest.equity_curve as [string, number][]}
                    initialCapital={initialCapital}
                    currency={currency}
                  />
                )}
                {backtest.drawdown_curve && (
                  <DrawdownChart drawdownCurve={backtest.drawdown_curve as [string, number][]} />
                )}
                {backtest.monthly_returns && (
                  <MonthlyReturns monthlyReturns={backtest.monthly_returns as { month: string; return_percent: number }[]} />
                )}
              </>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
                <p className="text-sm text-slate-500">No performance data available.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Trades */}
        {tab === "Trades" && (
          <div>
            {backtest?.trades ? (
              <TradeTable trades={backtest.trades as any[]} currency={currency} />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
                <p className="text-sm text-slate-500">No trade data available.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Strategy Logic */}
        {tab === "Strategy Logic" && (
          <div className="space-y-6">
            {/* Entry Rules */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">Entry Rules</h3>
              {entryRules.length > 0 ? (
                <div className="space-y-4">
                  {entryRules.map((rule) => {
                    const ruleName = rule.name as string;
                    const side = rule.side as string;
                    const conditions = rule.conditions as AnyObj | undefined;
                    const sizing = rule.position_sizing as AnyObj | undefined;

                    return (
                      <div key={rule.id as string} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-800">
                          {ruleName}{" "}
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                            side === "long" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                          }`}>
                            {(side ?? "").toUpperCase()}
                          </span>
                        </p>
                        {conditions && (
                          <div className="mt-2 font-mono text-xs text-slate-600 space-y-0.5">
                            {renderConditions(conditions, indicators)}
                          </div>
                        )}
                        {sizing && (
                          <p className="mt-2 text-xs text-slate-500">
                            THEN {side === "long" ? "BUY" : "SELL"}{" "}
                            {sizing.percent ? `${sizing.percent}% of portfolio` : (sizing.method as string ?? "").replace(/_/g, " ")}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No entry rules defined.</p>
              )}
            </div>

            {/* Exit Rules */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">Exit Rules</h3>
              {exitRules.length > 0 ? (
                <div className="space-y-2">
                  {exitRules.map((rule) => (
                    <div key={rule.id as string} className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {EXIT_TYPE_LABELS[(rule.type as string)] ?? (rule.type as string)}
                      </span>
                      <span>
                        {rule.value != null ? `at ${rule.value}%` : ""}
                      </span>
                      {rule.priority != null && (
                        <span className="text-xs text-slate-400">Priority {rule.priority as number}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No exit rules defined.</p>
              )}
            </div>

            {/* Indicators */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">Indicators</h3>
              {indicators.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="pb-2 font-medium">ID</th>
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium">Parameters</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {indicators.map((ind) => (
                        <tr key={ind.id as string}>
                          <td className="py-2 font-mono text-xs text-slate-600">{ind.id as string}</td>
                          <td className="py-2">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700">
                              {ind.type as string}
                            </span>
                          </td>
                          <td className="py-2 text-xs text-slate-600">
                            {Object.entries((ind.params as Record<string, unknown>) ?? {}).map(([k, v]) => (
                              <span key={k} className="mr-2">
                                {k}: <span className="font-medium">{String(v)}</span>
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No indicators defined.</p>
              )}
            </div>

            {/* Risk Management */}
            {Object.keys(riskMgmt).length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">Risk Management</h3>
                <div className="space-y-1 text-sm text-slate-700">
                  {riskMgmt.max_portfolio_drawdown_percent != null && (
                    <p>Max portfolio drawdown: <span className="font-medium">{riskMgmt.max_portfolio_drawdown_percent as number}%</span></p>
                  )}
                  {riskMgmt.max_position_count != null && (
                    <p>Max positions: <span className="font-medium">{riskMgmt.max_position_count as number}</span></p>
                  )}
                  {riskMgmt.max_single_position_percent != null && (
                    <p>Max single position: <span className="font-medium">{riskMgmt.max_single_position_percent as number}%</span></p>
                  )}
                  {riskMgmt.max_correlated_positions != null && (
                    <p>Max correlated positions: <span className="font-medium">{riskMgmt.max_correlated_positions as number}</span></p>
                  )}
                </div>
              </div>
            )}

            {/* Raw JSON */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                onClick={() => setJsonOpen(!jsonOpen)}
                className="flex w-full items-center justify-between px-6 py-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <span>Raw Strategy JSON</span>
                <span className="text-xs text-slate-400">{jsonOpen ? "Collapse" : "Expand"}</span>
              </button>
              {jsonOpen && (
                <div className="border-t border-slate-200 px-6 py-4">
                  <pre className="max-h-96 overflow-auto rounded-lg bg-slate-50 p-4 text-xs text-slate-600 font-mono">
                    {JSON.stringify(def, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          For educational purposes only. Not investment advice.
        </p>
      </div>
    </div>
  );
}

/** Recursively render conditions as human-readable text. */
function renderConditions(condGroup: AnyObj, indicators: AnyObj[]): React.ReactNode {
  const logic = condGroup.logic as string | undefined;
  const conditions = condGroup.conditions as AnyObj[] | undefined;

  if (!conditions || conditions.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {conditions.map((c, i) => {
        // Nested condition group
        if (c.logic && c.conditions) {
          return (
            <div key={i}>
              {i > 0 && <span className="text-blue-600 font-semibold">{logic ?? "AND"} </span>}
              {renderConditions(c, indicators)}
            </div>
          );
        }

        const left = c.left as AnyObj | undefined;
        const right = c.right as AnyObj | undefined;
        const operator = OPERATOR_LABELS[(c.operator as string)] ?? (c.operator as string);

        const leftStr = resolveOperand(left, indicators);
        const rightStr = resolveOperand(right, indicators);

        return (
          <p key={c.id as string ?? i}>
            {i > 0 && <span className="text-blue-600 font-semibold">{logic ?? "AND"} </span>}
            <span>IF </span>
            <span className="font-medium text-slate-800">{leftStr}</span>
            <span> {operator} </span>
            <span className="font-medium text-slate-800">{rightStr}</span>
          </p>
        );
      })}
    </div>
  );
}

function resolveOperand(op: AnyObj | undefined, indicators: AnyObj[]): string {
  if (!op) return "?";
  const type = op.type as string;
  if (type === "constant") return String(op.value);
  if (type === "indicator") {
    const indId = op.indicator_id as string;
    const ind = indicators.find((i) => (i.id as string) === indId);
    if (ind) {
      const period = (ind.params as AnyObj)?.period;
      return `${ind.type as string}(${period ?? ""})`;
    }
    return indId;
  }
  if (type === "price") return (op.field as string) ?? "price";
  return String(op.value ?? op.indicator_id ?? "?");
}
