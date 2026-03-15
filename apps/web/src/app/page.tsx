"use client";
import { useState } from "react";
import { generateStrategy, runBacktest, getConfidenceScore } from "@/lib/api";
import { StrategyCard } from "@/components/strategy/StrategyCard";
import { ConfidenceCard } from "@/components/confidence/ConfidenceCard";
import { ScoreCard } from "@/components/score/ScoreCard";
import { MetricsSummary } from "@/components/backtest/MetricsSummary";
import { EquityCurve } from "@/components/backtest/EquityCurve";
import { DrawdownChart } from "@/components/backtest/DrawdownChart";
import { TradeTable } from "@/components/backtest/TradeTable";

const QUICK_CHIPS = [
  { label: "Momentum — US Large Caps",  value: "Momentum strategy for US large cap stocks like AAPL, MSFT, GOOGL. Moderate risk, 1-2 week holds." },
  { label: "Mean Reversion — NIFTY50",  value: "Mean reversion strategy for top NIFTY50 stocks. Conservative risk, buy oversold dips." },
  { label: "Swing Trade — Tech",        value: "Swing trading strategy for tech stocks. Aggressive risk, 3-7 day holds using RSI and MACD." },
  { label: "Golden Cross — Moderate",   value: "Golden cross EMA 50/200 crossover on US equities. Moderate risk, long-term holds." },
  { label: "Breakout — Small Caps",     value: "Breakout strategy for US small cap growth stocks. Aggressive, enter on volume breakouts." },
];

type Step = "idle" | "generating" | "generated" | "backtesting" | "backtested" | "scoring" | "done";
type AnyObj = Record<string, unknown>;

export default function Home() {
  const [prompt,      setPrompt]      = useState("");
  const [step,        setStep]        = useState<Step>("idle");
  const [error,       setError]       = useState<string | null>(null);
  const [strategy,    setStrategy]    = useState<AnyObj | null>(null);
  const [strategyId,  setStrategyId]  = useState<string | null>(null);
  const [backtest,    setBacktest]    = useState<AnyObj | null>(null);
  const [confidence,  setConfidence]  = useState<AnyObj | null>(null);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setStep("generating");
    setError(null);
    setStrategy(null);
    setStrategyId(null);
    setBacktest(null);
    setConfidence(null);
    try {
      const data = await generateStrategy(prompt.trim());
      setStrategy(data.strategy ?? data);
      setStrategyId(data.strategyId ?? null);
      setStep("generated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setStep("idle");
    }
  }

  async function handleBacktest() {
    if (!strategy) return;
    setStep("backtesting");
    setError(null);
    setConfidence(null);
    try {
      const data = await runBacktest(strategy, strategyId ?? undefined);
      // Engine returns { success, result, duration_ms }
      const result = (data.result ?? data) as AnyObj;
      setBacktest(result);
      setStep("backtested");

      // Auto-run confidence scoring after backtest
      setStep("scoring");
      try {
        const conf = await getConfidenceScore(strategy, result);
        setConfidence(conf.confidence ?? conf);
      } catch {
        // Confidence scoring is best-effort; don't block the user
      }
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backtest failed");
      setStep("generated");
    }
  }

  const isGenerating  = step === "generating";
  const isBacktesting = step === "backtesting" || step === "scoring";
  const showStrategy  = strategy !== null && step !== "idle" && step !== "generating";
  const showBacktest  = backtest !== null && (step === "backtested" || step === "scoring" || step === "done");
  const initialCapital = (strategy?.backtest_config as AnyObj | undefined)?.initial_capital as number ?? 100000;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">

        {/* Hero */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Strategy<span className="text-blue-600">Forge</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Describe a trading idea in plain English — AI generates a backtestable strategy.
          </p>
        </div>

        {/* Input */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Describe your strategy
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Momentum strategy for top US tech stocks, moderate risk, hold 1-2 weeks using RSI and EMA crossover…"
            rows={3}
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip.label}
                onClick={() => setPrompt(chip.value)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                {chip.label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-400">Powered by Gemini 2.5 Flash</p>
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating || isBacktesting}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <Spinner /> Generating…
                </span>
              ) : "Generate Strategy"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Backtesting / scoring status */}
        {isBacktesting && (
          <div className="mt-6 flex items-center justify-center gap-3 rounded-xl border border-blue-100 bg-blue-50 py-8 text-sm text-blue-700">
            <Spinner className="text-blue-600" />
            {step === "scoring"
              ? "Analysing live market conditions…"
              : "Running backtest — fetching market data and simulating trades…"}
          </div>
        )}

        {/* Strategy card */}
        {showStrategy && (
          <div className="mt-6">
            <StrategyCard
              strategy={strategy}
              onRunBacktest={handleBacktest}
              loading={isBacktesting}
            />
          </div>
        )}

        {/* Backtest results */}
        {showBacktest && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Backtest Results</h2>
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">5-year period</span>
            </div>

            {/* Score + Metrics */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <ScoreCard score={backtest.score} />
              <div className="lg:col-span-2">
                <MetricsSummary summary={backtest.summary} />
              </div>
            </div>

            {/* Confidence + Charts */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {confidence ? (
                <ConfidenceCard confidence={confidence as Parameters<typeof ConfidenceCard>[0]["confidence"]} />
              ) : step === "scoring" ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 flex items-center justify-center text-sm text-slate-400 gap-2">
                  <Spinner /> Scoring live conditions…
                </div>
              ) : null}
              <div className="lg:col-span-2">
                <EquityCurve equityCurve={backtest.equity_curve as [string, number][]} initialCapital={initialCapital} />
              </div>
            </div>

            <DrawdownChart drawdownCurve={backtest.drawdown_curve as [string, number][]} />
            <TradeTable trades={backtest.trades as unknown[]} />
          </div>
        )}

      </div>
    </div>
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />
  );
}
