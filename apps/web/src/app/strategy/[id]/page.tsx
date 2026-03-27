"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, FileJson, ShieldCheck } from "lucide-react";
import { getStrategy } from "@/lib/api";
import { ScoreCard } from "@/components/score/ScoreCard";
import { ConfidenceCard } from "@/components/confidence/ConfidenceCard";
import { MetricsSummary } from "@/components/backtest/MetricsSummary";
import { EquityCurve } from "@/components/backtest/EquityCurve";
import { DrawdownChart } from "@/components/backtest/DrawdownChart";
import { MonthlyReturns } from "@/components/backtest/MonthlyReturns";
import { TradeTable } from "@/components/backtest/TradeTable";
import { MethodologyDisclosure } from "@/components/backtest/MethodologyDisclosure";
import { gradeColor, fmtDate } from "@/lib/utils";
import { CardSkeleton, ChartSkeleton, TableSkeleton } from "@/components/Skeleton";

type AnyObj = Record<string, unknown>;
type ScoreData = ComponentProps<typeof ScoreCard>["score"];
type ConfidenceData = ComponentProps<typeof ConfidenceCard>["confidence"];
type SummaryData = ComponentProps<typeof MetricsSummary>["summary"];
type TradesData = ComponentProps<typeof TradeTable>["trades"];
type EquityCurveData = ComponentProps<typeof EquityCurve>["equityCurve"];
type DrawdownCurveData = ComponentProps<typeof DrawdownChart>["drawdownCurve"];
type MonthlyReturnsData = ComponentProps<typeof MonthlyReturns>["monthlyReturns"];

function downloadJson(data: AnyObj, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const TABS = ["Overview", "Performance", "Trades", "Strategy Logic"] as const;
type Tab = (typeof TABS)[number];

const STYLE_COLORS: Record<string, string> = {
  momentum: "border-cyan-300/40 bg-cyan-500/10 text-cyan-100",
  mean_reversion: "border-fuchsia-300/40 bg-fuchsia-500/10 text-fuchsia-100",
  swing: "border-indigo-300/40 bg-indigo-500/10 text-indigo-100",
  positional: "border-teal-300/40 bg-teal-500/10 text-teal-100",
  intraday: "border-orange-300/40 bg-orange-500/10 text-orange-100",
  portfolio: "border-emerald-300/40 bg-emerald-500/10 text-emerald-100",
  hybrid: "border-white/10 bg-white/5 text-[color:var(--ink-muted)]",
};

const RISK_COLORS: Record<string, string> = {
  conservative: "border-emerald-300/40 bg-emerald-500/10 text-emerald-100",
  moderate: "border-amber-300/40 bg-amber-500/10 text-amber-100",
  aggressive: "border-rose-300/40 bg-rose-500/10 text-rose-100",
};

const EXIT_TYPE_LABELS: Record<string, string> = {
  stop_loss: "Stop Loss",
  take_profit: "Take Profit",
  trailing_stop: "Trailing Stop",
  time_based: "Time Exit",
  indicator: "Indicator Exit",
  indicator_based: "Indicator Exit",
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

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass-panel px-6 py-14 text-center">
      <p className="text-xl font-semibold text-[color:var(--ink-strong)]">{title}</p>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[color:var(--ink-muted)]">{body}</p>
    </div>
  );
}

function LogicCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="glass-panel p-6">
      <p className="eyebrow">{subtitle}</p>
      <h3 className="mt-2 text-2xl font-semibold text-[color:var(--ink-strong)]">{title}</h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}

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
      const data = await getStrategy(id);
      const nextStrategy = data.strategy as AnyObj;
      setStrategy(nextStrategy);
      setDefinition((nextStrategy.definition as AnyObj) ?? null);

      const backtestRuns = nextStrategy.backtestRuns as AnyObj[] | undefined;
      if (backtestRuns && backtestRuns.length > 0) {
        setBacktest((backtestRuns[0].result as AnyObj) ?? null);
      }
    } catch {
      try {
        const stored = localStorage.getItem(`strategy_${id}`);
        if (stored) {
          const parsed = JSON.parse(stored) as AnyObj;
          setStrategy(parsed);
          setDefinition((parsed.definition as AnyObj) ?? parsed);
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
      <div className="page-shell">
        <CardSkeleton />
        <div className="grid gap-6 lg:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <ChartSkeleton />
        <TableSkeleton />
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div className="page-shell-tight">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[color:var(--ink-muted)] transition hover:text-[color:var(--ink-strong)]">
          <ArrowLeft className="h-4 w-4" />
          Back to generator
        </Link>
        <div className="rounded-[28px] border border-rose-300/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          {error || "Strategy not found"}
        </div>
      </div>
    );
  }

  const def = definition ?? strategy;
  const name = (strategy.name as string) ?? (def.name as string) ?? "Untitled Strategy";
  const description = (strategy.description as string) ?? (def.description as string) ?? "";
  const style = (def.style as string) ?? (strategy.style as string) ?? "";
  const riskLevel = (def.risk_level as string) ?? (strategy.riskLevel as string) ?? "";
  const market = ((def.universe as AnyObj)?.market as string) ?? (strategy.market as string) ?? "";
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
    <div className="page-shell">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[color:var(--ink-muted)] transition hover:text-[color:var(--ink-strong)]">
          <ArrowLeft className="h-4 w-4" />
          Back to generator
        </Link>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => downloadJson(def, `${slugify(name)}.json`)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--ink-strong)] transition hover:border-white/20 hover:bg-white/10"
          >
            <FileJson className="h-3.5 w-3.5" />
            Export strategy
          </button>
          {backtest && (
            <button
              onClick={() => downloadJson(backtest, `${slugify(name)}-backtest.json`)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--ink-strong)] transition hover:border-white/20 hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5" />
              Export results
            </button>
          )}
        </div>
      </div>

      <section className="glass-panel p-7 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
          <div>
            <p className="eyebrow">Strategy Profile</p>
            <h1 className="display-title mt-3 max-w-3xl text-4xl sm:text-5xl">{name}</h1>
            {description && (
              <p className="mt-5 max-w-2xl text-base leading-7 text-[color:var(--ink-muted)]">{description}</p>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              {style && (
                <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${STYLE_COLORS[style] ?? STYLE_COLORS.hybrid}`}>
                  {style.replace(/_/g, " ")}
                </span>
              )}
              {riskLevel && (
                <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${RISK_COLORS[riskLevel] ?? STYLE_COLORS.hybrid}`}>
                  {riskLevel} risk
                </span>
              )}
              {market && (
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                  {market}
                </span>
              )}
              {timeframe && (
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                  {timeframe} chart
                </span>
              )}
              {grade && (
                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${gradeColor(grade)}`}>
                  Grade {grade}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="soft-panel p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">Created</p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--ink-strong)]">
                {createdAt ? fmtDate(createdAt) : "Unknown"}
              </p>
            </div>
            <div className="soft-panel p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">Universe</p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--ink-strong)]">{market || "Flexible"}</p>
            </div>
            <div className="soft-panel p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">Protection</p>
              <p className="mt-3 flex items-center gap-2 text-lg font-semibold text-[color:var(--ink-strong)]">
                <ShieldCheck className="h-4 w-4 text-[color:var(--accent)]" />
                {Object.keys(riskMgmt).length > 0 ? "Defined" : "Minimal"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-panel overflow-x-auto p-2">
        <div className="flex min-w-max gap-2">
          {TABS.map((nextTab) => (
            <button
              key={nextTab}
              onClick={() => setTab(nextTab)}
              className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
                tab === nextTab
                  ? "bg-[color:var(--accent)] text-[color:var(--bg)] shadow-[0_14px_34px_rgba(234,174,88,0.24)]"
                  : "text-[color:var(--ink-muted)] hover:bg-white/[0.06] hover:text-[color:var(--ink-strong)]"
              }`}
            >
              {nextTab}
            </button>
          ))}
        </div>
      </section>

      {tab === "Overview" && (
        <div className="space-y-6">
          {(score || confidence) && (
            <section className="grid gap-6 xl:grid-cols-2">
              {score && <ScoreCard score={score as unknown as ScoreData} />}
              {confidence && (
                <div>
                  <ConfidenceCard confidence={confidence as unknown as ConfidenceData} />
                  {confidenceUpdatedAt && !backtestConfidence && (
                    <p className="mt-3 text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                      Confidence updated {fmtDate(confidenceUpdatedAt)}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {summary && <MetricsSummary summary={summary as unknown as SummaryData} />}

          {!backtest && !confidence && (
            <EmptyState
              title="No backtest results available."
              body="Run a backtest from the generator to populate scorecards, equity curves, and trade-level evidence for this strategy."
            />
          )}

          {!backtest && confidence && (
            <EmptyState
              title="Confidence is saved, but performance is missing."
              body="The live conviction model is available above, but a full backtest is still needed to unlock performance and trade statistics."
            />
          )}

          <MethodologyDisclosure currency={currency} />
        </div>
      )}

      {tab === "Performance" && (
        <div className="space-y-6">
          {backtest ? (
            <>
              {backtest.equity_curve && (
                <EquityCurve
                  equityCurve={backtest.equity_curve as unknown as EquityCurveData}
                  initialCapital={initialCapital}
                  currency={currency}
                />
              )}
              {backtest.drawdown_curve && (
                <DrawdownChart drawdownCurve={backtest.drawdown_curve as unknown as DrawdownCurveData} />
              )}
              {backtest.monthly_returns && (
                <MonthlyReturns monthlyReturns={backtest.monthly_returns as unknown as MonthlyReturnsData} />
              )}
              <MethodologyDisclosure currency={currency} />
            </>
          ) : (
            <EmptyState
              title="No performance data available."
              body="Backtest this strategy to unlock the equity curve, drawdown path, and monthly return map."
            />
          )}
        </div>
      )}

      {tab === "Trades" && (
        <div className="space-y-6">
          {backtest?.trades ? (
            <TradeTable trades={backtest.trades as unknown as TradesData} currency={currency} />
          ) : (
            <EmptyState
              title="No trade log available."
              body="Once a backtest has run, executed entries and exits will appear here for review."
            />
          )}
        </div>
      )}

      {tab === "Strategy Logic" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <LogicCard title="Entry Rules" subtitle="Signal Logic">
            {entryRules.length > 0 ? (
              <div className="space-y-4">
                {entryRules.map((rule) => {
                  const ruleName = rule.name as string;
                  const side = rule.side as string;
                  const conditions = rule.conditions as AnyObj | undefined;
                  const sizing = rule.position_sizing as AnyObj | undefined;

                  return (
                    <div key={(rule.id as string) ?? ruleName} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-[color:var(--ink-strong)]">{ruleName}</p>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.22em] ${
                            side === "long"
                              ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100"
                              : "border-rose-300/40 bg-rose-500/10 text-rose-100"
                          }`}
                        >
                          {(side ?? "").toUpperCase()}
                        </span>
                      </div>
                      {conditions && (
                        <div className="mt-4 overflow-x-auto rounded-[18px] border border-white/[0.08] bg-[color:var(--bg-strong)]/[0.60] p-4 font-mono text-xs leading-6 text-[color:var(--ink-muted)]">
                          {renderConditions(conditions, indicators)}
                        </div>
                      )}
                      {sizing && (
                        <p className="mt-4 text-sm leading-6 text-[color:var(--ink-muted)]">
                          Position sizing:{" "}
                          <span className="text-[color:var(--ink-strong)]">
                            {sizing.percent ? `${sizing.percent}% of capital` : String(sizing.method ?? "custom").replace(/_/g, " ")}
                          </span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[color:var(--ink-muted)]">No entry rules defined.</p>
            )}
          </LogicCard>

          <LogicCard title="Exit Rules" subtitle="Protection & Profit Taking">
            {exitRules.length > 0 ? (
              <div className="space-y-4">
                {exitRules.map((rule) => {
                  const type = rule.type as string;
                  const conditions = rule.conditions as AnyObj | undefined;

                  return (
                    <div key={(rule.id as string) ?? `${type}-${rule.priority as number}`} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                          {EXIT_TYPE_LABELS[type] ?? type}
                        </span>
                        {rule.priority != null && (
                          <span className="text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                            Priority {rule.priority as number}
                          </span>
                        )}
                      </div>

                      {rule.value != null && (
                        <p className="mt-3 text-sm text-[color:var(--ink-muted)]">
                          Trigger level: <span className="font-medium text-[color:var(--ink-strong)]">{String(rule.value)}%</span>
                        </p>
                      )}

                      {conditions && (
                        <div className="mt-4 overflow-x-auto rounded-[18px] border border-white/[0.08] bg-[color:var(--bg-strong)]/[0.60] p-4 font-mono text-xs leading-6 text-[color:var(--ink-muted)]">
                          {renderConditions(conditions, indicators)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[color:var(--ink-muted)]">No exit rules defined.</p>
            )}
          </LogicCard>

          <LogicCard title="Indicators" subtitle="Signal Inputs">
            {indicators.length > 0 ? (
              <div className="space-y-3">
                {indicators.map((indicator) => (
                  <div key={indicator.id as string} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="mono rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                        {indicator.id as string}
                      </span>
                      <span className="text-base font-semibold text-[color:var(--ink-strong)]">
                        {indicator.type as string}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {Object.entries((indicator.params as Record<string, unknown>) ?? {}).map(([key, value]) => (
                        <span
                          key={key}
                          className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-[color:var(--ink-muted)]"
                        >
                          {key}: <span className="text-[color:var(--ink-strong)]">{String(value)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[color:var(--ink-muted)]">No indicators defined.</p>
            )}
          </LogicCard>

          <LogicCard title="Risk Controls" subtitle="Capital Discipline">
            {Object.keys(riskMgmt).length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {riskMgmt.max_portfolio_drawdown_percent != null && (
                  <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">Max Portfolio Drawdown</p>
                    <p className="mt-2 text-lg font-semibold text-[color:var(--ink-strong)]">
                      {riskMgmt.max_portfolio_drawdown_percent as number}%
                    </p>
                  </div>
                )}
                {riskMgmt.max_position_count != null && (
                  <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">Max Positions</p>
                    <p className="mt-2 text-lg font-semibold text-[color:var(--ink-strong)]">
                      {riskMgmt.max_position_count as number}
                    </p>
                  </div>
                )}
                {riskMgmt.max_single_position_percent != null && (
                  <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">Max Single Position</p>
                    <p className="mt-2 text-lg font-semibold text-[color:var(--ink-strong)]">
                      {riskMgmt.max_single_position_percent as number}%
                    </p>
                  </div>
                )}
                {riskMgmt.max_correlated_positions != null && (
                  <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">Max Correlated Positions</p>
                    <p className="mt-2 text-lg font-semibold text-[color:var(--ink-strong)]">
                      {riskMgmt.max_correlated_positions as number}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[color:var(--ink-muted)]">No dedicated risk controls defined.</p>
            )}
          </LogicCard>

          <section className="glass-panel overflow-hidden xl:col-span-2">
            <button
              onClick={() => setJsonOpen((prev) => !prev)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
            >
              <div>
                <p className="eyebrow">Raw Definition</p>
                <h3 className="mt-2 text-2xl font-semibold text-[color:var(--ink-strong)]">Strategy JSON</h3>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">
                {jsonOpen ? "Collapse" : "Expand"}
              </span>
            </button>
            {jsonOpen && (
              <div className="border-t border-white/[0.08] px-6 py-6">
                <pre className="max-h-[32rem] overflow-auto rounded-[22px] border border-white/[0.08] bg-[color:var(--bg-strong)]/[0.70] p-5 text-xs leading-6 text-[color:var(--ink-muted)]">
                  {JSON.stringify(def, null, 2)}
                </pre>
              </div>
            )}
          </section>
        </div>
      )}

      <p className="pb-2 text-center text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">
        Educational use only. Not investment advice.
      </p>
    </div>
  );
}

function renderConditions(conditionGroup: AnyObj, indicators: AnyObj[]): ReactNode {
  const logic = conditionGroup.logic as string | undefined;
  const conditions = conditionGroup.conditions as AnyObj[] | undefined;

  if (!conditions || conditions.length === 0) return null;

  return (
    <div className="space-y-1">
      {conditions.map((condition, index) => {
        if (condition.logic && condition.conditions) {
          return (
            <div key={index}>
              {index > 0 && <span className="font-semibold text-[color:var(--accent)]">{logic ?? "AND"} </span>}
              {renderConditions(condition, indicators)}
            </div>
          );
        }

        const left = condition.left as AnyObj | undefined;
        const right = condition.right as AnyObj | undefined;
        const operator = OPERATOR_LABELS[(condition.operator as string)] ?? (condition.operator as string);
        const leftText = resolveOperand(left, indicators);
        const rightText = resolveOperand(right, indicators);

        return (
          <p key={(condition.id as string) ?? index}>
            {index > 0 && <span className="font-semibold text-[color:var(--accent)]">{logic ?? "AND"} </span>}
            <span>IF </span>
            <span className="text-[color:var(--ink-strong)]">{leftText}</span>
            <span> {operator} </span>
            <span className="text-[color:var(--ink-strong)]">{rightText}</span>
          </p>
        );
      })}
    </div>
  );
}

function resolveOperand(operand: AnyObj | undefined, indicators: AnyObj[]): string {
  if (!operand) return "?";

  const type = operand.type as string;
  if (type === "constant") return String(operand.value);
  if (type === "indicator") {
    const indicatorId = operand.indicator_id as string;
    const indicator = indicators.find((item) => (item.id as string) === indicatorId);
    if (indicator) {
      const period = (indicator.params as AnyObj)?.period;
      return `${indicator.type as string}(${period ?? ""})`;
    }
    return indicatorId;
  }
  if (type === "price") return (operand.field as string) ?? "price";
  return String(operand.value ?? operand.indicator_id ?? "?");
}
