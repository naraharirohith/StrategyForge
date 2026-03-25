"use client";
import { useState } from "react";
import { generateStrategy, runBacktest, getConfidenceScore } from "@/lib/api";
import { StrategyCard } from "@/components/strategy/StrategyCard";
import { ConfidenceCard } from "@/components/confidence/ConfidenceCard";
import { ScoreCard } from "@/components/score/ScoreCard";
import { MetricsSummary } from "@/components/backtest/MetricsSummary";
import { EquityCurve } from "@/components/backtest/EquityCurve";
import { DrawdownChart } from "@/components/backtest/DrawdownChart";
import { MonthlyReturns } from "@/components/backtest/MonthlyReturns";
import { TradeTable } from "@/components/backtest/TradeTable";
import { MethodologyDisclosure } from "@/components/backtest/MethodologyDisclosure";

const TEMPLATES = [
  // Momentum
  { category: "Momentum", label: "Golden Cross — US Large Caps", value: "Momentum strategy using EMA 50/200 golden cross on US large cap stocks like AAPL, MSFT, GOOGL. Moderate risk, enter when fast EMA crosses above slow EMA and RSI confirms momentum below 60. Stop loss 5%, take profit 15%. Daily timeframe, hold 2-8 weeks." },
  { category: "Momentum", label: "Breakout — Volume Surge", value: "Breakout strategy for US stocks that enters when price breaks above 20-day high with volume 2x above average. Use ADX to confirm trend strength. Aggressive risk, 8% stop loss, 20% take profit target. Stocks: NVDA, AMZN, META, TSLA." },
  { category: "Momentum", label: "NIFTY Supertrend", value: "Momentum strategy for top Indian NIFTY50 stocks using Supertrend indicator with ATR period 10, multiplier 3. Enter long when price is above Supertrend and ADX > 25. Moderate risk, 5% stop loss, trailing stop 8%. Daily timeframe. Stocks: RELIANCE.NS, TCS.NS, HDFCBANK.NS, INFY.NS." },

  // Mean Reversion
  { category: "Mean Reversion", label: "RSI Oversold Bounce", value: "Mean reversion strategy buying US stocks when RSI(14) drops below 30 and price is above SMA(200) for trend confirmation. Conservative risk, 3% stop loss, exit when RSI rises above 50. Stocks: AAPL, MSFT, JPM, JNJ, SPY." },
  { category: "Mean Reversion", label: "Bollinger Band Squeeze", value: "Mean reversion strategy that buys when price touches lower Bollinger Band (20, 2) and RSI(14) < 35, sells when price returns to middle band. Conservative risk, daily timeframe. US large caps: AAPL, GOOGL, MSFT, AMZN." },
  { category: "Mean Reversion", label: "NIFTY RSI Dip Buyer", value: "Mean reversion strategy for Indian market. Buy top NIFTY50 stocks when RSI(14) drops below 25 and price is above EMA(100). Conservative risk, 4% stop loss, take profit at 10%. Stocks: RELIANCE.NS, ICICIBANK.NS, HDFCBANK.NS, TCS.NS, INFY.NS." },

  // Swing Trading
  { category: "Swing", label: "MACD Crossover Swing", value: "Swing trading strategy using MACD crossover with signal line. Enter when MACD crosses above signal and price is above EMA(50). Moderate risk, hold 5-15 days. 6% stop loss, 12% take profit, trailing stop 8%. US tech stocks: NVDA, AAPL, MSFT, AMD, GOOGL." },
  { category: "Swing", label: "Stochastic + EMA Filter", value: "Swing strategy buying when Stochastic %K crosses above %D below 20 (oversold) while price is above EMA(50). Moderate risk, daily timeframe, hold 3-10 days. 5% stop loss, 10% take profit. Stocks: SPY, QQQ, AAPL, MSFT." },

  // Trend Following
  { category: "Trend", label: "ADX Trend Rider", value: "Trend following strategy that enters when ADX(14) rises above 25 (strong trend), price is above EMA(20), and RSI(14) is between 40-70 (not overbought). Moderate risk, trailing stop 10%, time exit after 30 bars. US stocks: AAPL, NVDA, TSLA, AMZN." },
  { category: "Trend", label: "Ichimoku Cloud Strategy", value: "Trend strategy using Ichimoku Cloud. Enter long when price breaks above the cloud (above both Senkou Span A and B), Tenkan-sen crosses above Kijun-sen, and Chikou Span is above price. Conservative risk, hold weeks to months. Stocks: AAPL, MSFT, GOOGL." },

  // Multi-indicator
  { category: "Multi-Indicator", label: "Triple Confirmation", value: "Multi-indicator strategy requiring triple confirmation: EMA(20) above EMA(50) for trend, RSI(14) between 40-65 for momentum, and MACD histogram positive. Moderate risk, 5% stop loss, 15% take profit, trailing stop 8%. Daily timeframe, US large caps." },
  { category: "Multi-Indicator", label: "India All-Weather", value: "Diversified Indian market strategy using RSI, Bollinger Bands, and ADX across multiple NIFTY50 stocks. Enter on RSI oversold + price near lower Bollinger Band + ADX > 20. Conservative risk, 4% stop loss. Stocks: RELIANCE.NS, TCS.NS, HDFCBANK.NS, BHARTIARTL.NS, ITC.NS." },
];

type Step = "idle" | "generating" | "generated" | "backtesting" | "backtested" | "scoring" | "done";
type AnyObj = Record<string, unknown>;

export default function Home() {
  const [prompt,      setPrompt]      = useState("");
  const [provider,    setProvider]    = useState<string>("gemini");
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
      const data = await generateStrategy(prompt.trim(), undefined, provider);
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
        const conf = await getConfidenceScore(strategy, result, strategyId ?? undefined);
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
  const currency = (strategy?.backtest_config as AnyObj | undefined)?.currency as string ?? "USD";

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
        <p className="mb-6 text-center text-xs text-slate-400">
          For educational purposes only. Not investment advice. Past performance does not guarantee future results.
        </p>

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
          {/* Strategy Templates */}
          <div className="mt-3">
            <p className="text-xs font-medium text-slate-400 mb-2">Quick templates:</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  onClick={() => setPrompt(t.value)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    prompt === t.value
                      ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-slate-400">AI Model:</span>
            {[
              { id: "gemini", label: "Gemini Flash", sub: "Free" },
              { id: "openrouter", label: "OpenRouter", sub: "Free" },
              { id: "claude", label: "Claude", sub: "Paid" },
              { id: "openai", label: "GPT-4o", sub: "Paid" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  provider === p.id
                    ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                {p.label} <span className="text-slate-400">({p.sub})</span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Powered by {provider === "gemini" ? "Gemini Flash" : provider === "claude" ? "Claude" : provider === "openai" ? "GPT-4o" : "OpenRouter"}
            </p>
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
              strategy={strategy as any}
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

            {!!backtest.summary && (backtest.summary as any).total_trades < 30 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <span className="font-medium">Low sample size:</span> Only {(backtest.summary as any).total_trades} trades in this backtest.
                Results with fewer than 30 trades may not be statistically reliable. Consider testing over a longer period or with more tickers.
              </div>
            )}

            {/* Score + Metrics */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <ScoreCard score={backtest.score as any} />
              <div className="lg:col-span-2">
                <MetricsSummary summary={backtest.summary as any} />
              </div>
            </div>

            {/* Confidence + Charts */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {confidence ? (
                <ConfidenceCard confidence={confidence as any} />
              ) : step === "scoring" ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 flex items-center justify-center text-sm text-slate-400 gap-2">
                  <Spinner /> Scoring live conditions…
                </div>
              ) : null}
              <div className="lg:col-span-2">
                <EquityCurve equityCurve={backtest.equity_curve as [string, number][]} initialCapital={initialCapital} currency={currency} benchmarkReturnPct={(backtest.summary as any)?.benchmark_return_percent} />
              </div>
            </div>

            <DrawdownChart drawdownCurve={backtest.drawdown_curve as [string, number][]} />
            <MonthlyReturns monthlyReturns={backtest.monthly_returns as { month: string; return_percent: number }[]} />
            <TradeTable trades={backtest.trades as any[]} currency={currency} />
            <MethodologyDisclosure
              commissionPct={(strategy?.backtest_config as AnyObj | undefined)?.commission_percent as number | undefined}
              slippagePct={(strategy?.backtest_config as AnyObj | undefined)?.slippage_percent as number | undefined}
              currency={currency}
            />
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
