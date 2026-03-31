"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { getStrategy } from "@/lib/api";
import { ScoreCard } from "@/components/score/ScoreCard";
import { ConfidenceCard } from "@/components/confidence/ConfidenceCard";
import { MetricsSummary } from "@/components/backtest/MetricsSummary";
import { WalkForwardCard } from "@/components/backtest/WalkForwardCard";
import { EquityCurve } from "@/components/backtest/EquityCurve";
import { DrawdownChart } from "@/components/backtest/DrawdownChart";
import { MonthlyReturns } from "@/components/backtest/MonthlyReturns";
import { TradeTable } from "@/components/backtest/TradeTable";
import { gradeColor, fmtDate } from "@/lib/utils";
import { CardSkeleton, ChartSkeleton } from "@/components/Skeleton";

type AnyObj = Record<string, unknown>;

function downloadJson(data: AnyObj, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const TABS = ["Overview", "Performance", "Trades", "Strategy Logic"] as const;
type Tab = (typeof TABS)[number];

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
  const [tickerMetrics, setTickerMetrics] = useState<Record<string, unknown>[] | null>(null);
  const [news, setNews] = useState<Array<{title: string; url: string; source: string; published_at: string}> | null>(null);

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

  useEffect(() => {
    if (!definition) return;
    const tickers = (definition?.universe as any)?.tickers as string[] | undefined;
    const market = (definition?.universe as any)?.market as string | undefined;
    if (!tickers?.length || !market) return;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    fetch(`${API_URL}/api/market/screener/tickers?tickers=${tickers.join(",")}&market=${market}`)
      .then((r) => r.json())
      .then((d) => setTickerMetrics(d.stocks ?? null))
      .catch(() => null);
  }, [definition]);

  useEffect(() => {
    if (!strategy) return;
    const mkt = (strategy.market as string) ?? "US";
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    fetch(`${API_URL}/api/market/news?market=${mkt}&limit=6`)
      .then((r) => r.json())
      .then((d) => setNews(d.headlines ?? null))
      .catch(() => null);
  }, [strategy]);

  if (loading) {
    return (
      <div className="min-h-screen">
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
      <div className="min-h-screen">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <a href="/" className="text-sm text-blue-600 hover:text-blue-700">&larr; Back to Generator</a>
          <div className="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
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
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Navigation */}
        <a href="/" className="text-sm text-blue-600 hover:text-blue-700">&larr; Back to Generator</a>

        {/* Header */}
        <div className="mt-4 mb-6">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-100">{name}</h1>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => downloadJson(def, `${slugify(name)}.json`)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-gray-200"
              >
                Export JSON
              </button>
              {backtest && (
                <button
                  onClick={() => downloadJson(backtest, `${slugify(name)}-backtest.json`)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-gray-200"
                >
                  Export Results
                </button>
              )}
            </div>
          </div>
          {description && <p className="mt-1 text-sm text-gray-400">{description}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {style && (
              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STYLE_COLORS[style] ?? "bg-white/[0.06] text-gray-400 border-white/[0.06]"}`}>
                {style.replace(/_/g, " ")}
              </span>
            )}
            {riskLevel && (
              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${RISK_COLORS[riskLevel] ?? "bg-white/[0.06] text-gray-400 border-white/[0.06]"}`}>
                {riskLevel} risk
              </span>
            )}
            {market && (
              <span className="inline-flex items-center rounded border border-white/[0.06] bg-transparent px-2 py-0.5 text-xs text-gray-400">
                {market}
              </span>
            )}
            {timeframe && (
              <span className="inline-flex items-center rounded border border-white/[0.06] bg-transparent px-2 py-0.5 text-xs text-gray-400">
                {timeframe} chart
              </span>
            )}
            {grade && (
              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-bold ${gradeColor(grade)}`}>
                Grade {grade}
              </span>
            )}
            {createdAt && (
              <span className="inline-flex items-center text-xs text-gray-500">
                Created {fmtDate(createdAt)}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 overflow-x-auto rounded-lg border border-white/[0.06] bg-[#111118] p-1">
          <div className="flex gap-1 min-w-max">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 whitespace-nowrap rounded-md px-3 py-2 text-xs sm:text-sm font-medium transition-colors ${
                  tab === t
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
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
                      <p className="mt-2 text-xs text-gray-500">
                        Last updated: {fmtDate(confidenceUpdatedAt)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Live Market Position */}
            {tickerMetrics && tickerMetrics.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-[#111118] p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Live Market Position</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {tickerMetrics.map((s) => {
                    const ticker = s.ticker as string;
                    const price = s.price as number;
                    const ret = s.return_1m as number | null;
                    const trend = s.trend as string;
                    const pe = s.pe_ratio as number | null;
                    const above200 = s.above_ema200 as boolean | null;
                    const currency = s.currency as string;
                    const symbol = currency === "INR" ? "₹" : "$";
                    const retStr = ret != null ? `${ret >= 0 ? "+" : ""}${ret.toFixed(1)}%` : "N/A";
                    const trendColor = trend === "bullish" ? "text-emerald-400" : trend === "bearish" ? "text-red-400" : "text-yellow-400";
                    const retColor = ret != null && ret >= 0 ? "text-emerald-400" : "text-red-400";
                    return (
                      <div key={ticker} className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
                        <p className="text-xs font-semibold text-white">{ticker.replace(".NS", "")}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{symbol}{price.toLocaleString()}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className={`text-xs font-medium ${retColor}`}>{retStr}</span>
                          <span className={`text-[10px] ${trendColor} capitalize`}>{trend}</span>
                        </div>
                        {(pe != null || above200 != null) && (
                          <p className="mt-1 text-[10px] text-gray-500">
                            {pe != null ? `P/E ${pe}` : ""}
                            {pe != null && above200 != null ? " · " : ""}
                            {above200 === true ? "↑EMA200" : above200 === false ? "↓EMA200" : ""}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Market News */}
            {news && news.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-[#111118] p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Market News</h3>
                <div className="space-y-2">
                  {news.map((item, i) => (
                    <a
                      key={i}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg bg-white/[0.03] border border-white/[0.04] px-3 py-2.5 hover:bg-white/[0.06] transition-colors group"
                    >
                      <p className="text-xs text-gray-200 leading-snug group-hover:text-white line-clamp-2">
                        {item.title}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-600">
                        <span>{item.source}</span>
                        {item.published_at && (
                          <>
                            <span>·</span>
                            <span>{item.published_at.slice(0, 10)}</span>
                          </>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Zero trades warning */}
            {!!backtest?.zero_trades_warning && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <span className="text-amber-400 mt-0.5 text-base">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-amber-300">No trades executed</p>
                  <p className="text-xs text-amber-200/70 mt-0.5">{String(backtest.zero_trades_warning)}</p>
                </div>
              </div>
            )}

            {/* Metrics */}
            {summary && (
              <MetricsSummary summary={summary as any} />
            )}

            {/* Walk-Forward Validation */}
            {!!backtest?.walk_forward && (
              <WalkForwardCard result={(backtest.walk_forward) as any} />
            )}

            {/* No backtest */}
            {!backtest && !confidence && (
              <div className="rounded-2xl border border-white/[0.06] bg-[#111118] px-6 py-12 text-center">
                <p className="text-sm text-gray-400">No backtest results available.</p>
                <p className="mt-1 text-xs text-gray-500">
                  Run a backtest from the{" "}
                  <a href="/" className="text-blue-600 hover:text-blue-700">Generator</a>
                  {" "}to see scores and metrics.
                </p>
              </div>
            )}
            {!backtest && confidence && (
              <div className="rounded-2xl border border-white/[0.06] bg-[#111118] px-6 py-8 text-center">
                <p className="text-sm text-gray-400">No backtest results yet. Showing persisted confidence score above.</p>
                <p className="mt-1 text-xs text-gray-500">
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
            {!!backtest?.zero_trades_warning && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <span className="text-amber-400 mt-0.5 text-base">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-amber-300">No trades executed</p>
                  <p className="text-xs text-amber-200/70 mt-0.5">{String(backtest.zero_trades_warning)}</p>
                </div>
              </div>
            )}
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
              <div className="rounded-2xl border border-white/[0.06] bg-[#111118] px-6 py-12 text-center">
                <p className="text-sm text-gray-400">No performance data available.</p>
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
              <div className="rounded-2xl border border-white/[0.06] bg-[#111118] px-6 py-12 text-center">
                <p className="text-sm text-gray-400">No trade data available.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Strategy Logic */}
        {tab === "Strategy Logic" && (
          <div className="space-y-6">
            {/* Entry Rules */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Entry Rules</h3>
              {entryRules.length > 0 ? (
                <div className="space-y-4">
                  {entryRules.map((rule) => {
                    const ruleName = rule.name as string;
                    const side = rule.side as string;
                    const conditions = rule.conditions as AnyObj | undefined;
                    const sizing = rule.position_sizing as AnyObj | undefined;

                    return (
                      <div key={rule.id as string} className="rounded-lg border border-white/[0.06] bg-white/[0.06] p-4">
                        <p className="text-sm font-semibold text-gray-200">
                          {ruleName}{" "}
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                            side === "long" ? "bg-green-500/15 text-green-400" : "bg-red-500/10 text-red-400"
                          }`}>
                            {(side ?? "").toUpperCase()}
                          </span>
                        </p>
                        {conditions && (
                          <div className="mt-2 font-mono text-xs text-gray-400 space-y-0.5 overflow-x-auto">
                            {renderConditions(conditions, indicators)}
                          </div>
                        )}
                        {sizing && (
                          <p className="mt-2 text-xs text-gray-400">
                            THEN {side === "long" ? "BUY" : "SELL"}{" "}
                            {sizing.percent ? `${sizing.percent}% of portfolio` : (sizing.method as string ?? "").replace(/_/g, " ")}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No entry rules defined.</p>
              )}
            </div>

            {/* Exit Rules */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Exit Rules</h3>
              {exitRules.length > 0 ? (
                <div className="space-y-2">
                  {exitRules.map((rule) => (
                    <div key={rule.id as string} className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
                      <span className="rounded bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-gray-400">
                        {EXIT_TYPE_LABELS[(rule.type as string)] ?? (rule.type as string)}
                      </span>
                      <span>
                        {rule.value != null ? `at ${rule.value}%` : ""}
                      </span>
                      {rule.priority != null && (
                        <span className="text-xs text-gray-500">Priority {rule.priority as number}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No exit rules defined.</p>
              )}
            </div>

            {/* Indicators */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Indicators</h3>
              {indicators.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-xs text-gray-400">
                        <th className="pb-2 font-medium">ID</th>
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium">Parameters</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {indicators.map((ind) => (
                        <tr key={ind.id as string}>
                          <td className="py-2 font-mono text-xs text-gray-400">{ind.id as string}</td>
                          <td className="py-2">
                            <span className="rounded bg-white/[0.06] px-2 py-0.5 text-xs font-mono text-gray-300">
                              {ind.type as string}
                            </span>
                          </td>
                          <td className="py-2 text-xs text-gray-400">
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
                <p className="text-sm text-gray-500">No indicators defined.</p>
              )}
            </div>

            {/* Risk Management */}
            {Object.keys(riskMgmt).length > 0 && (
              <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Risk Management</h3>
                <div className="space-y-1 text-sm text-gray-300">
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
            <div className="rounded-2xl border border-white/[0.06] bg-[#111118]">
              <button
                onClick={() => setJsonOpen(!jsonOpen)}
                className="flex w-full items-center justify-between px-6 py-4 text-sm font-medium text-gray-300 hover:bg-white/5"
              >
                <span>Raw Strategy JSON</span>
                <span className="text-xs text-gray-500">{jsonOpen ? "Collapse" : "Expand"}</span>
              </button>
              {jsonOpen && (
                <div className="border-t border-white/[0.06] px-3 py-4 sm:px-6">
                  <pre className="max-h-96 overflow-auto rounded-lg bg-white/[0.06] p-3 sm:p-4 text-xs text-gray-400 font-mono whitespace-pre overflow-x-auto">
                    {JSON.stringify(def, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-gray-500">
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
            <span className="font-medium text-gray-200">{leftStr}</span>
            <span> {operator} </span>
            <span className="font-medium text-gray-200">{rightStr}</span>
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
