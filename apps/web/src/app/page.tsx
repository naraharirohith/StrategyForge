"use client";
import { useState } from "react";
import { generateStrategy, streamBacktest, getConfidenceScore } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { StrategyCard } from "@/components/strategy/StrategyCard";
import { ConfidenceCard } from "@/components/confidence/ConfidenceCard";
import { ScoreCard } from "@/components/score/ScoreCard";
import { MetricsSummary } from "@/components/backtest/MetricsSummary";
import { EquityCurve } from "@/components/backtest/EquityCurve";
import { DrawdownChart } from "@/components/backtest/DrawdownChart";
import { MonthlyReturns } from "@/components/backtest/MonthlyReturns";
import { TradeTable } from "@/components/backtest/TradeTable";
import { MethodologyDisclosure } from "@/components/backtest/MethodologyDisclosure";
import { SimpleMode } from "@/components/simple/SimpleMode";

type Market = "US" | "IN" | "CRYPTO";

interface SectorTile {
  label: string;
  value: string;
  icon: string;
}

interface MarketConfig {
  flag: string;
  label: string;
  currency: string;
  sectors: SectorTile[];
  promptHint: string;
}

const MARKET_CONFIG: Record<Market, MarketConfig> = {
  US: {
    flag: "🇺🇸",
    label: "US",
    currency: "USD",
    sectors: [
      { label: "Technology", value: "technology", icon: "💻" },
      { label: "Healthcare", value: "healthcare", icon: "🏥" },
      { label: "Financials", value: "financials", icon: "🏦" },
      { label: "Energy", value: "energy", icon: "⚡" },
      { label: "Consumer", value: "consumer", icon: "🛍️" },
      { label: "Industrials", value: "industrials", icon: "🏭" },
    ],
    promptHint: "e.g. I want to invest in tech stocks with good momentum",
  },
  IN: {
    flag: "🇮🇳",
    label: "India",
    currency: "INR",
    sectors: [
      { label: "IT", value: "it", icon: "💻" },
      { label: "Banking", value: "banking", icon: "🏦" },
      { label: "Pharma", value: "pharma", icon: "💊" },
      { label: "Energy", value: "energy", icon: "⚡" },
      { label: "Auto", value: "auto", icon: "🚗" },
      { label: "FMCG", value: "fmcg", icon: "🛒" },
    ],
    promptHint: "e.g. I want to invest in Nifty IT stocks with strong momentum",
  },
  CRYPTO: {
    flag: "₿",
    label: "Crypto",
    currency: "USD",
    sectors: [
      { label: "Layer 1", value: "layer1", icon: "⛓️" },
      { label: "DeFi", value: "defi", icon: "🔄" },
      { label: "Layer 2", value: "layer2", icon: "⚡" },
      { label: "Gaming", value: "gaming", icon: "🎮" },
      { label: "Exchange", value: "exchange", icon: "💱" },
    ],
    promptHint: "e.g. I want to invest in Layer 1 coins with bullish momentum",
  },
};

const SAFE_TEMPLATES = [
  { category: "Momentum", label: "Golden Cross - US Large Caps", value: "Create a daily momentum strategy for AAPL, MSFT, and GOOGL using EMA 20 and EMA 50 with RSI(14) confirmation. Moderate risk. Enter long when EMA 20 crosses above EMA 50 and RSI stays below 65. Use a 5% stop loss, 12% take profit, and a 20-bar time exit. Keep timeframe at 1d." },
  { category: "Momentum", label: "Breakout - Volume Surge", value: "Create a daily breakout strategy for NVDA, AMZN, META, and TSLA. Use Donchian Channel 20-day breakout, volume SMA(20), and ADX(14). Enter long when price breaks the 20-day high, volume is above volume SMA, and ADX is above 20. Aggressive risk with 7% stop loss, 18% take profit, and trailing stop 8%. Keep timeframe at 1d." },
  { category: "Momentum", label: "NIFTY Supertrend", value: "Create a daily momentum strategy for RELIANCE.NS, TCS.NS, HDFCBANK.NS, and INFY.NS using Supertrend(10,3), EMA 50, and ADX(14). Enter long when price is above Supertrend, price is above EMA 50, and ADX is above 20. Moderate risk with 5% stop loss and trailing stop 8%. Keep timeframe at 1d." },
  { category: "Mean Reversion", label: "RSI Oversold Bounce", value: "Create a daily mean reversion strategy for AAPL, MSFT, JPM, JNJ, and SPY. Use RSI(14), EMA 50, and Bollinger Bands(20,2). Buy when RSI drops below 30, price touches the lower Bollinger Band, and price remains above EMA 50. Conservative risk with 3% stop loss, 8% take profit, and exit if RSI rises above 55. Keep timeframe at 1d." },
  { category: "Mean Reversion", label: "Bollinger Band Reclaim", value: "Create a daily mean reversion strategy for AAPL, GOOGL, MSFT, and AMZN. Use Bollinger Bands(20,2), RSI(14), and ATR(14). Buy when price closes back above the lower Bollinger Band after being below it and RSI is below 35. Conservative risk with 4% stop loss and 8% take profit. Keep timeframe at 1d." },
  { category: "Mean Reversion", label: "NIFTY RSI Dip Buyer", value: "Create a daily Indian-market mean reversion strategy for RELIANCE.NS, ICICIBANK.NS, HDFCBANK.NS, TCS.NS, and INFY.NS. Use RSI(14), EMA 50, and Bollinger Bands(20,2). Buy when RSI drops below 28, price is near the lower Bollinger Band, and price stays above EMA 50. Conservative risk with 4% stop loss and 10% take profit. Keep timeframe at 1d." },
  { category: "Swing", label: "MACD Crossover Swing", value: "Create a daily swing trading strategy for NVDA, AAPL, MSFT, AMD, and GOOGL using MACD(12,26,9), EMA 50, and RSI(14). Enter long when MACD crosses above its signal line, price is above EMA 50, and RSI is between 40 and 65. Moderate risk with 6% stop loss, 12% take profit, and trailing stop 8%. Keep timeframe at 1d." },
  { category: "Swing", label: "Stochastic + EMA Filter", value: "Create a daily swing strategy for SPY, QQQ, AAPL, and MSFT using Stochastic(14,3), EMA 50, and ATR(14). Buy when Stochastic %K crosses above %D below 25 and price is above EMA 50. Moderate risk with 5% stop loss, 10% take profit, and a 12-bar time exit. Keep timeframe at 1d." },
  { category: "Trend", label: "ADX Trend Rider", value: "Create a daily trend-following strategy for AAPL, NVDA, TSLA, and AMZN using ADX(14), EMA 20, EMA 50, and RSI(14). Enter long when ADX rises above 20, EMA 20 is above EMA 50, and RSI is between 45 and 70. Moderate risk with trailing stop 10% and time exit after 30 bars. Keep timeframe at 1d." },
  { category: "Trend", label: "Cloud Breakout", value: "Create a daily trend strategy for AAPL, MSFT, and GOOGL using EMA 20, EMA 50, and Donchian Channel 20 instead of very long intraday indicators. Enter long when price closes above the Donchian upper band, EMA 20 is above EMA 50, and RSI is below 70. Conservative risk with 5% stop loss and trailing stop 10%. Keep timeframe at 1d." },
  { category: "Multi-Indicator", label: "Triple Confirmation", value: "Create a daily multi-indicator strategy for US large caps using EMA 20, EMA 50, RSI(14), and MACD(12,26,9). Enter long only when EMA 20 is above EMA 50, RSI is between 40 and 65, and MACD histogram is positive. Moderate risk with 5% stop loss, 15% take profit, and trailing stop 8%. Keep timeframe at 1d." },
  { category: "Multi-Indicator", label: "India All-Weather", value: "Create a daily diversified Indian-market strategy for RELIANCE.NS, TCS.NS, HDFCBANK.NS, BHARTIARTL.NS, and ITC.NS using RSI(14), Bollinger Bands(20,2), EMA 50, and ADX(14). Enter long when RSI is recovering from below 35, price is near the lower Bollinger Band, EMA 50 trend is intact, and ADX is above 18. Conservative risk with 4% stop loss and 9% take profit. Keep timeframe at 1d." },
];

type Step = "idle" | "generating" | "generated" | "backtesting" | "backtested" | "scoring" | "done";
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

export default function Home() {
  const [mode,        setMode]        = useState<"simple" | "expert">("simple");
  const [market,      setMarket]      = useState<Market>("US");
  const [prompt,      setPrompt]      = useState("");
  const [provider,    setProvider]    = useState<string>("gemini");
  const [step,        setStep]        = useState<Step>("idle");
  const [error,       setError]       = useState<string | null>(null);
  const [redirect,    setRedirect]    = useState<{ message: string; suggestion: string } | null>(null);
  const [strategy,    setStrategy]    = useState<AnyObj | null>(null);
  const [strategyId,  setStrategyId]  = useState<string | null>(null);
  const [backtest,    setBacktest]    = useState<AnyObj | null>(null);
  const [confidence,  setConfidence]  = useState<AnyObj | null>(null);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const { toast } = useToast();

  function handleSectorClick(sector: SectorTile) {
    const hint =
      market === "IN"
        ? `I want to invest in India ${sector.label} sector stocks. Show me which stocks are performing well and suggest an entry strategy.`
        : market === "CRYPTO"
        ? `I want to invest in ${sector.label} crypto assets. Show me which coins are performing well and suggest an entry strategy.`
        : `I want to invest in US ${sector.label} sector stocks. Show me which stocks are performing well and suggest an entry strategy.`;
    setPrompt(hint);
  }

  function handleSwitchToExpert(loadedStrategy?: AnyObj) {
    setMode("expert");
    if (loadedStrategy) {
      setStrategy(loadedStrategy);
      setStep("generated");
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setStep("generating");
    setError(null);
    setRedirect(null);
    setStrategy(null);
    setStrategyId(null);
    setBacktest(null);
    setConfidence(null);
    try {
      const data = await generateStrategy(
        prompt.trim(),
        { market, currency: MARKET_CONFIG[market].currency },
        provider,
      );
      if (data.unsupported) {
        setRedirect({ message: data.message, suggestion: data.suggestion });
        setStep("idle");
        return;
      }
      setStrategy(data.strategy ?? data);
      setStrategyId(data.strategyId ?? null);
      setStep("generated");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      setError(msg);
      toast(msg);
      setStep("idle");
    }
  }

  async function handleBacktest() {
    if (!strategy) return;
    setStep("backtesting");
    setError(null);
    setConfidence(null);
    setProgressMsg("Starting backtest...");

    try {
      const result = await new Promise<AnyObj>((resolve, reject) => {
        streamBacktest(
          strategy,
          strategyId ?? undefined,
          (_stage, message) => {
            setProgressMsg(message);
          },
          (result) => {
            resolve(result as AnyObj);
          },
          (error) => {
            reject(new Error(error));
          },
        );
      });

      setBacktest(result);
      setProgressMsg(null);
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
      const msg = e instanceof Error ? e.message : "Backtest failed";
      setError(msg);
      setProgressMsg(null);
      toast(msg);
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
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">

        {/* Hero */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-100 sm:text-4xl">
            Strategy<span className="text-blue-600">Forge</span>
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Describe a trading idea in plain English — AI generates a backtestable strategy.
          </p>
        </div>
        <p className="mb-6 text-center text-xs text-gray-500">
          For educational purposes only. Not investment advice. Past performance does not guarantee future results.
        </p>

        {/* Mode Toggle */}
        <div className="mb-6 flex justify-center">
          <div className="flex items-center gap-1 rounded-full border border-white/[0.06] bg-[#111118] p-1">
            <button
              onClick={() => setMode("simple")}
              className={mode === "simple"
                ? "rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white"
                : "rounded-full px-5 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
              }
            >
              Simple Mode
            </button>
            <button
              onClick={() => setMode("expert")}
              className={mode === "expert"
                ? "rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white"
                : "rounded-full px-5 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
              }
            >
              Expert Mode
            </button>
          </div>
        </div>

        {/* Simple Mode */}
        {mode === "simple" && (
          <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-6">
            <SimpleMode onSwitchToExpert={handleSwitchToExpert} />
          </div>
        )}

        {/* Expert Mode */}
        {mode === "expert" && (
          <>
            {/* Market Toggle */}
            <div className="flex gap-2 mb-6">
              {(Object.keys(MARKET_CONFIG) as Market[]).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMarket(m);
                    setPrompt("");
                    setStrategy(null);
                    setBacktest(null);
                    setConfidence(null);
                    setStep("idle");
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    market === m
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10"
                  }`}
                >
                  <span>{MARKET_CONFIG[m].flag}</span>
                  <span>{MARKET_CONFIG[m].label}</span>
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Describe your strategy
              </label>
              {/* Sector Tiles */}
              <div className="flex flex-wrap gap-2 mb-4">
                {MARKET_CONFIG[market].sectors.map((sector) => (
                  <button
                    key={sector.value}
                    onClick={() => handleSectorClick(sector)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-gray-300 hover:bg-blue-600/20 hover:border-blue-500/50 hover:text-white transition-all"
                  >
                    <span>{sector.icon}</span>
                    <span>{sector.label}</span>
                  </button>
                ))}
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={MARKET_CONFIG[market].promptHint}
                rows={3}
                className="w-full resize-none rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {/* Strategy Templates */}
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Quick templates:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SAFE_TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      onClick={() => setPrompt(t.value)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        prompt === t.value
                          ? "border-blue-500 bg-blue-500/10 text-blue-400 font-medium"
                          : "border-white/[0.06] text-gray-400 hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-400"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500">AI Model:</span>
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
                        ? "border-blue-500 bg-blue-500/10 text-blue-400 font-medium"
                        : "border-white/[0.06] text-gray-500 hover:border-white/10"
                    }`}
                  >
                    {p.label} <span className="text-gray-500">({p.sub})</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-500">
                  Powered by {provider === "gemini" ? "Gemini Flash" : provider === "claude" ? "Claude" : provider === "openai" ? "GPT-4o" : "OpenRouter"}
                </p>
                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isGenerating || isBacktesting}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <span className="flex items-center gap-2">
                      <Spinner /> Generating...
                    </span>
                  ) : "Generate Strategy"}
                </button>
              </div>
            </div>

            {/* Unsupported instrument redirect */}
            {redirect && (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm">
                <p className="font-semibold text-amber-400 mb-1">Not supported yet</p>
                <p className="text-amber-300/80 mb-3">{redirect.message}</p>
                <p className="text-amber-300/60 text-xs">
                  <span className="font-medium text-amber-400">Try instead:</span> {redirect.suggestion}
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Backtesting / scoring status */}
            {isBacktesting && (
              <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 py-8 text-sm text-blue-400">
                <Spinner className="text-blue-500" />
                {progressMsg || (step === "scoring"
                  ? "Analysing live market conditions..."
                  : "Running backtest...")}
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
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => {
                      const name = slugify((strategy?.name as string) ?? "strategy");
                      downloadJson(strategy!, `${name}.json`);
                    }}
                    className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-sm font-medium text-gray-400 hover:bg-white/5"
                  >
                    Export JSON
                  </button>
                </div>
              </div>
            )}

            {/* Backtest results */}
            {showBacktest && (
              <div className="mt-8 space-y-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-100">Backtest Results</h2>
                  <span className="rounded-full bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 text-xs font-medium text-green-400">5-year period</span>
                  <div className="ml-auto">
                    <button
                      onClick={() => {
                        const name = slugify((strategy?.name as string) ?? "strategy");
                        downloadJson(backtest!, `${name}-backtest.json`);
                      }}
                      className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-sm font-medium text-gray-400 hover:bg-white/5"
                    >
                      Export Results
                    </button>
                  </div>
                </div>

                {!!backtest.summary && (backtest.summary as any).total_trades < 30 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
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
                    <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-6 flex items-center justify-center text-sm text-gray-500 gap-2">
                      <Spinner /> Scoring live conditions...
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
          </>
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
