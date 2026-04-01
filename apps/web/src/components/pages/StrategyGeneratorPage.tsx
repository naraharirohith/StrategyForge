"use client";
import { useState } from "react";
import { generateStrategy, streamBacktest, getConfidenceScore, explainBacktest } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { StrategyCard } from "@/components/strategy/StrategyCard";
import { CurrentSetupCard, type TickerSetup } from "@/components/strategy/CurrentSetupCard";
import { ConfidenceCard } from "@/components/confidence/ConfidenceCard";
import { ScoreCard } from "@/components/score/ScoreCard";
import { MetricsSummary } from "@/components/backtest/MetricsSummary";
import { WalkForwardCard } from "@/components/backtest/WalkForwardCard";
import { EquityCurve } from "@/components/backtest/EquityCurve";
import { DrawdownChart } from "@/components/backtest/DrawdownChart";
import { MonthlyReturns } from "@/components/backtest/MonthlyReturns";
import { TradeTable } from "@/components/backtest/TradeTable";
import { MethodologyDisclosure } from "@/components/backtest/MethodologyDisclosure";
import { SimpleMode } from "@/components/simple/SimpleMode";
import { type Market, type SectorTile, MARKET_CONFIG } from "@/lib/marketConfig";

interface SectorStock {
  ticker: string;
  price: number;
  return_1m: number | null;
  above_ema200: boolean | null;
  pe_ratio: number | null;
  trend: "bullish" | "bearish" | "sideways";
  currency: string;
}

type HitRateRow = {
  label: string;
  hitRate: number | null;
};

async function fetchSectorStocks(market: Market, sector: string): Promise<SectorStock[]> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const res = await fetch(`${API_URL}/api/market/screener?market=${market}&sector=${sector}&limit=6`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.stocks ?? []) as SectorStock[];
}

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

function periodToStartDate(period: "1Y" | "2Y" | "3Y" | "5Y"): string {
  const days = { "1Y": 365, "2Y": 730, "3Y": 1095, "5Y": 1825 }[period];
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

interface Props {
  market: Market;
}

export function StrategyGeneratorPage({ market }: Props) {
  const [mode, setMode] = useState<"trade" | "invest">("trade");
  const [tradeMode, setTradeMode] = useState<"simple" | "expert">("simple");
  const [investInput, setInvestInput] = useState("");
  const [backtestPeriod, setBacktestPeriod] = useState<"1Y" | "2Y" | "3Y" | "5Y">("5Y");
  const [prompt,      setPrompt]      = useState("");
  const [provider,    setProvider]    = useState<string>("openrouter");
  const [orModel,     setOrModel]     = useState<string>("qwen/qwen3.6-plus-preview:free");
  const [step,        setStep]        = useState<Step>("idle");
  const [error,       setError]       = useState<string | null>(null);
  const [redirect,    setRedirect]    = useState<{ message: string; suggestion: string } | null>(null);
  const [strategy,    setStrategy]    = useState<AnyObj | null>(null);
  const [strategyId,  setStrategyId]  = useState<string | null>(null);
  const [backtest,    setBacktest]    = useState<AnyObj | null>(null);
  const [confidence,  setConfidence]  = useState<AnyObj | null>(null);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [clarification, setClarification] = useState<{
    questions: Array<{ id: string; label: string; options?: string[] }>;
  } | null>(null);
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({});
  const [sectorStocks, setSectorStocks] = useState<SectorStock[] | null>(null);
  const [sectorLoading, setSectorLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [liveTickerData, setLiveTickerData] = useState<TickerSetup[] | null>(null);
  const { toast } = useToast();

  function handleSectorClick(sector: SectorTile) {
    const hint = market === "IN"
      ? `I want to invest in India ${sector.label} sector stocks. Show me which stocks are performing well and suggest an entry strategy.`
      : `I want to invest in US ${sector.label} sector stocks. Show me which stocks are performing well and suggest an entry strategy.`;
    setPrompt(hint);
    setSectorStocks(null);
    setSectorLoading(true);
    fetchSectorStocks(market, sector.value)
      .then(setSectorStocks)
      .catch(() => setSectorStocks([]))
      .finally(() => setSectorLoading(false));
  }

  function handleSwitchToExpert(loadedStrategy?: AnyObj) {
    setMode("trade");
    setTradeMode("expert");
    if (loadedStrategy) {
      setStrategy(loadedStrategy);
      setStep("generated");
    }
  }

  async function handleGenerate(overridePrompt?: string) {
    const descriptionToUse = (overridePrompt ?? prompt).trim();
    if (!descriptionToUse) return;
    setStep("generating");
    setError(null);
    setRedirect(null);
    setStrategy(null);
    setStrategyId(null);
    setBacktest(null);
    setConfidence(null);
    setExplanation(null);
    setLiveTickerData(null);
    try {
      const config = MARKET_CONFIG[market];
      const data = await generateStrategy(
        descriptionToUse,
        {
          market,
          currency: config.currency,
          commission_percent: config.commissionPct,
          slippage_percent: config.slippagePct,
        },
        provider,
        provider === "openrouter" ? orModel : undefined,
      );
      if (data.unsupported) {
        setRedirect({ message: data.message, suggestion: data.suggestion });
        setStep("idle");
        return;
      }
      // Handle clarification request
      if (data.needs_clarification && data.questions) {
        setClarification({ questions: data.questions });
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

  function handleClarificationSubmit() {
    const parts: string[] = [prompt.trim()];
    const { sector, style, horizon, capital } = clarificationAnswers;
    if (sector) parts.push(`focusing on ${sector} sector`);
    if (style) parts.push(`using ${style.toLowerCase()} approach`);
    if (horizon) parts.push(`with ${horizon.toLowerCase()} horizon`);
    if (capital) parts.push(`with ${capital} capital`);
    const enriched = parts.join(", ");
    setClarification(null);
    setClarificationAnswers({});
    setPrompt(enriched);
    setTimeout(() => handleGenerate(enriched), 0);
  }

  async function handleBacktest() {
    if (!strategy) return;
    setStep("backtesting");
    setError(null);
    setConfidence(null);
    setExplanation(null);
    setProgressMsg("Starting backtest...");

    const strategyWithPeriod = {
      ...(strategy as Record<string, unknown>),
      backtest_config: {
        ...((strategy as Record<string, unknown>).backtest_config as Record<string, unknown> ?? {}),
        start_date: periodToStartDate(backtestPeriod),
      },
    };

    try {
      const result = await new Promise<AnyObj>((resolve, reject) => {
        streamBacktest(
          strategyWithPeriod,
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

      // Non-blocking — fetch live prices for current setup card
      const tickers = (strategy as AnyObj | null)?.universe
        ? ((strategy as AnyObj).universe as AnyObj).tickers as string[] | undefined
        : undefined;
      const mkt = (strategy as AnyObj | null)?.universe
        ? ((strategy as AnyObj).universe as AnyObj).market as string | undefined
        : undefined;
      if (tickers?.length && mkt) {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        fetch(`${API_URL}/api/market/screener/tickers?tickers=${tickers.join(",")}&market=${mkt}`)
          .then((r) => r.json())
          .then((d) => setLiveTickerData((d.stocks ?? []) as TickerSetup[]))
          .catch(() => null);
      }

      // Non-blocking — fetch plain English explanation
      if (result.summary && strategyWithPeriod) {
        explainBacktest(
          result.summary as Record<string, number>,
          strategyWithPeriod as Record<string, unknown>,
          (strategyWithPeriod as AnyObj)?.backtest_config !== undefined
            ? ((strategyWithPeriod as AnyObj).backtest_config as AnyObj)?.initial_capital as number ?? 100000
            : 100000
        ).then(setExplanation).catch(() => null);
      }

      // Auto-run confidence scoring after backtest
      setStep("scoring");
      try {
        const conf = await getConfidenceScore(strategyWithPeriod, result, strategyId ?? undefined);
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
  const tradeCount = Number((backtest?.summary as AnyObj | undefined)?.total_trades ?? 0);
  const hitRateRows = extractHitRateRows(backtest);
  const benchmarkReturnPct = (backtest?.summary as AnyObj | undefined)?.benchmark_return_percent as number | undefined;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">

        {/* Hero */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-100 sm:text-4xl">
            Strategy<span className="text-blue-600">Forge</span>
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Choose your intent first, then move from idea to a structured thesis or a backtestable strategy.
          </p>
          <p className="mt-3 text-xs text-gray-600">
            <a href="/" className="transition-colors hover:text-gray-400">
              ← Switch market
            </a>
            <span className="mx-2 text-gray-700">·</span>
            <span className="text-gray-500">{MARKET_CONFIG[market].flag} {MARKET_CONFIG[market].label}</span>
          </p>
        </div>
        <p className="mb-6 text-center text-xs text-gray-500">
          For educational purposes only. Not investment advice. Past performance does not guarantee future results.
        </p>

        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <IntentCard
            active={mode === "trade"}
            title="TRADE"
            description="Capitalize on a short-term pattern or momentum move. Days to 3 months."
            onClick={() => setMode("trade")}
          />
          <IntentCard
            active={mode === "invest"}
            title="INVEST"
            description="Build a position based on fundamentals and outlook. 6 months to years."
            onClick={() => setMode("invest")}
          />
        </div>

        {mode === "invest" && (
          <div className="rounded-3xl border border-white/[0.08] bg-[#111118] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300/80">
                Investment Input
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-gray-100">
                Start with a ticker or an investable theme
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-400">
                This mode is for long-horizon thesis building. The backend wiring comes in the next step, so for now we capture the idea cleanly and keep it ready for fundamentals-driven analysis.
              </p>
              <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  What do you want to research?
                </label>
                <input
                  type="text"
                  value={investInput}
                  onChange={(e) => setInvestInput(e.target.value)}
                  placeholder="Enter a ticker (AAPL, RELIANCE.NS) or describe a theme..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-100 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white opacity-60"
                  >
                    Investment thesis coming soon
                  </button>
                  <p className="text-xs text-gray-500">
                    Captured locally for now. No trade or backtest flow changes have been made.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mode Toggle */}
        {mode === "trade" && (
        <div className="mb-6 flex justify-center">
          <div className="flex items-center gap-1 rounded-full border border-white/[0.06] bg-[#111118] p-1">
            <button
              onClick={() => setTradeMode("simple")}
              className={tradeMode === "simple"
                ? "rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white"
                : "rounded-full px-5 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
              }
            >
              Simple Mode
            </button>
            <button
              onClick={() => setTradeMode("expert")}
              className={tradeMode === "expert"
                ? "rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white"
                : "rounded-full px-5 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
              }
            >
              Expert Mode
            </button>
          </div>
        </div>
        )}

        {/* Simple Mode */}
        {mode === "trade" && tradeMode === "simple" && (
          <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-6">
            <SimpleMode onSwitchToExpert={handleSwitchToExpert} />
          </div>
        )}

        {/* Expert Mode */}
        {mode === "trade" && tradeMode === "expert" && (
          <>
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

              {/* Sector Screener Panel */}
              {(sectorLoading || (sectorStocks && sectorStocks.length > 0)) && (
                <div className="mb-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  {sectorLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Spinner /> Loading top stocks...
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 mb-2 font-medium">Top performers right now</p>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {sectorStocks!.map((stock) => {
                          const ret = stock.return_1m;
                          const retStr = ret != null
                            ? `${ret >= 0 ? "+" : ""}${ret.toFixed(1)}%`
                            : "N/A";
                          const trendColor = stock.trend === "bullish"
                            ? "text-emerald-400"
                            : stock.trend === "bearish"
                            ? "text-red-400"
                            : "text-yellow-400";
                          const retColor = ret != null && ret >= 0 ? "text-emerald-400" : "text-red-400";
                          const symbol = stock.currency === "INR" ? "₹" : "$";
                          const hint = getEntryHint(stock);
                          return (
                            <div
                              key={stock.ticker}
                              className="px-2.5 py-2 rounded-lg bg-white/5 border border-white/[0.08]"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-semibold text-white leading-none">{stock.ticker.replace(".NS", "")}</p>
                                  <p className="text-[10px] text-gray-500 mt-0.5">{symbol}{stock.price.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                  <p className={`text-xs font-medium ${retColor}`}>{retStr}</p>
                                  <p className={`text-[10px] ${trendColor} capitalize`}>{stock.trend}</p>
                                </div>
                              </div>
                              {hint && (
                                <p className="mt-1.5 pt-1.5 border-t border-white/[0.06] text-[10px] text-blue-200/60 leading-tight">
                                  {hint}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

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
                {/* Free OpenRouter tiers */}
                {[
                  {
                    model: "deepseek/deepseek-r1:free",
                    label: "DeepSeek R1",
                    sub: "Free · Reasoning",
                  },
                  {
                    model: "qwen/qwen3.6-plus-preview:free",
                    label: "Qwen3.6 Plus",
                    sub: "Free · Fast",
                  },
                  {
                    model: "deepseek/deepseek-chat",
                    label: "DeepSeek V3",
                    sub: "Pro · Best quality",
                  },
                ].map((m) => {
                  const active = provider === "openrouter" && orModel === m.model;
                  return (
                    <button
                      key={m.model}
                      onClick={() => { setProvider("openrouter"); setOrModel(m.model); }}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        active
                          ? "border-blue-500 bg-blue-500/10 text-blue-400 font-medium"
                          : "border-white/[0.06] text-gray-500 hover:border-white/10"
                      }`}
                    >
                      {m.label} <span className="text-gray-500">({m.sub})</span>
                    </button>
                  );
                })}
                {/* Fallback options */}
                {[
                  { id: "gemini", label: "Gemini Flash", sub: "Fallback" },
                  { id: "claude", label: "Claude Sonnet", sub: "Premium" },
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
                  {provider === "openrouter"
                    ? orModel === "deepseek/deepseek-r1:free" ? "DeepSeek R1 — free reasoning model"
                    : orModel === "qwen/qwen3.6-plus-preview:free" ? "Qwen3.6 Plus — free, fast structured output"
                    : "DeepSeek V3 — production quality"
                    : provider === "claude" ? "Claude Sonnet 4.6"
                    : "Gemini 2.5 Flash"}
                </p>
                <button
                  onClick={() => handleGenerate()}
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

            {/* Clarification UI */}
            {clarification && (
              <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm font-medium text-amber-300 mb-3">
                  Help us tailor your strategy — answer a few quick questions:
                </p>
                <div className="space-y-3">
                  {clarification.questions.map((q) => (
                    <div key={q.id}>
                      <p className="text-xs text-gray-400 mb-1.5">{q.label}</p>
                      {q.options ? (
                        <div className="flex flex-wrap gap-1.5">
                          {q.options.map((opt) => (
                            <button
                              key={opt}
                              onClick={() => setClarificationAnswers(a => ({ ...a, [q.id]: opt }))}
                              className={`px-3 py-1 rounded-full text-xs transition-all ${
                                clarificationAnswers[q.id] === opt
                                  ? "bg-blue-600 text-white"
                                  : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={clarificationAnswers[q.id] ?? ""}
                          onChange={(e) => setClarificationAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                          placeholder={q.label}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleClarificationSubmit}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Generate strategy →
                  </button>
                  <button
                    onClick={() => { setClarification(null); handleGenerate(); }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 text-sm rounded-lg transition-colors border border-white/10"
                  >
                    Generate anyway
                  </button>
                </div>
              </div>
            )}

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
                {!showBacktest && !isBacktesting && (
                  <div className="mt-3 flex items-center gap-2 mb-4">
                    <span className="text-xs text-gray-500">Backtest period:</span>
                    {(["1Y", "2Y", "3Y", "5Y"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setBacktestPeriod(p)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          backtestPeriod === p
                            ? "border-blue-500 bg-blue-500/15 text-blue-400"
                            : "border-white/[0.06] text-gray-500 hover:border-white/10 hover:text-gray-300"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
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
                  <span className="rounded-full bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 text-xs font-medium text-green-400">{backtestPeriod} period</span>
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

                {/* Current Setup — live entry/stop/target for each ticker */}
                {liveTickerData && liveTickerData.length > 0 && !backtest?.zero_trades_warning && (() => {
                  const exitRules = (strategy as AnyObj | undefined)?.exit_rules as AnyObj[] | undefined ?? [];
                  const stopRule  = exitRules.find((r) => r.type === "stop_loss");
                  const tpRule    = exitRules.find((r) => r.type === "take_profit");
                  const stopPct   = (stopRule?.value as number) ?? 5;
                  const targetPct = (tpRule?.value  as number) ?? 15;
                  return (
                    <CurrentSetupCard
                      tickers={liveTickerData}
                      stopPct={stopPct}
                      targetPct={targetPct}
                    />
                  );
                })()}

                {!!backtest?.zero_trades_warning && (
                  <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                    <span className="text-amber-400 mt-0.5 text-base">⚠️</span>
                    <div>
                      <p className="text-sm font-semibold text-amber-300">No trades executed</p>
                      <p className="text-xs text-amber-200/70 mt-0.5">{String(backtest.zero_trades_warning)}</p>
                    </div>
                  </div>
                )}

                {explanation && !backtest?.zero_trades_warning && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <p className="text-xs font-semibold text-blue-300 mb-1">In plain English</p>
                    <p className="text-sm text-blue-100/80 leading-relaxed">{explanation}</p>
                  </div>
                )}

                {tradeCount > 0 && tradeCount < 30 && (
                  <ReliabilityBanner trades={tradeCount} />
                )}

                {/* Score + Metrics */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <ScoreCard score={backtest.score as any} />
                  <div className="lg:col-span-2">
                    <MetricsSummary summary={backtest.summary as any} />
                  </div>
                </div>

                {!!backtest.walk_forward && (
                  <WalkForwardCard result={backtest.walk_forward as any} />
                )}

                {hitRateRows.length > 0 && (
                  <RegimePerformanceCard rows={hitRateRows} />
                )}

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
                    <EquityCurve equityCurve={backtest.equity_curve as [string, number][]} initialCapital={initialCapital} currency={currency} benchmarkReturnPct={benchmarkReturnPct} />
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
                <BacktestDisclaimer />
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

function IntentCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-3xl border p-6 text-left transition-all ${
        active
          ? "border-blue-500/60 bg-[linear-gradient(135deg,rgba(37,99,235,0.2),rgba(17,17,24,0.96))] shadow-[0_20px_60px_rgba(37,99,235,0.14)]"
          : "border-white/[0.08] bg-[#111118] hover:border-white/[0.18] hover:bg-[#15151d]"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={`text-xs font-semibold tracking-[0.28em] ${active ? "text-blue-200" : "text-gray-500"}`}>
            {title}
          </p>
          <p className={`mt-3 text-base leading-7 ${active ? "text-gray-100" : "text-gray-300"}`}>
            {description}
          </p>
        </div>
        <span
          className={`h-3 w-3 rounded-full border ${
            active ? "border-blue-300 bg-blue-400 shadow-[0_0_18px_rgba(96,165,250,0.8)]" : "border-white/20 bg-transparent"
          }`}
        />
      </div>
    </button>
  );
}

function RegimePerformanceCard({ rows }: { rows: HitRateRow[] }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-200">Regime Performance</h3>
        <p className="mt-1 text-xs text-gray-500">
          Condition hit rates across the backtest window.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wide text-gray-500">
              <th className="pb-2 font-medium">Condition</th>
              <th className="pb-2 text-right font-medium">Hit Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="py-3 text-sm text-gray-300">{row.label}</td>
                <td className="py-3 text-right text-sm font-medium text-gray-100">{formatHitRate(row.hitRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReliabilityBanner({ trades }: { trades: number }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-200">
      ⚠ Only {trades} trades — results may not be statistically reliable
    </div>
  );
}

function BacktestDisclaimer() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-gray-400">
      Past performance in backtests does not predict future results. Chart patterns may not repeat in current market conditions.
    </div>
  );
}

function extractHitRateRows(result: AnyObj | null): HitRateRow[] {
  if (!result) return [];

  const signalDiagnostics = result.signal_diagnostics;
  const rows: HitRateRow[] = [];

  if (signalDiagnostics && typeof signalDiagnostics === "object") {
    for (const ruleStats of Object.values(signalDiagnostics as Record<string, unknown>)) {
      if (!ruleStats || typeof ruleStats !== "object") continue;
      for (const conditionStats of Object.values(ruleStats as Record<string, unknown>)) {
        if (!conditionStats || typeof conditionStats !== "object") continue;
        const data = conditionStats as Record<string, unknown>;
        const label = typeof data.description === "string" && data.description.trim()
          ? data.description.trim()
          : "Condition";
        const hitRate = typeof data.hit_rate_pct === "number" ? data.hit_rate_pct : null;
        rows.push({ label, hitRate });
      }
    }
  }

  if (rows.length > 0) return rows;

  const regimePerformance = result.regime_performance;
  if (!Array.isArray(regimePerformance)) return [];

  return regimePerformance
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      label: `${String(item.regime ?? "unknown")} regime`,
      hitRate: typeof item.win_rate === "number" ? item.win_rate : null,
    }));
}

function formatHitRate(hitRate: number | null): string {
  if (hitRate == null || Number.isNaN(hitRate)) return "N/A";
  return `${hitRate.toFixed(1)}%`;
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />
  );
}

function getEntryHint(stock: SectorStock): string | null {
  const { trend, above_ema200, return_1m, pe_ratio } = stock;
  if (trend === "bearish" && above_ema200 === false) {
    return "Below EMA200 — wait for reversal signal";
  }
  if (above_ema200 === false && trend === "sideways") {
    return "Testing EMA200 support — potential entry zone";
  }
  if (pe_ratio != null && pe_ratio < 12) {
    return `P/E ${pe_ratio}x — value zone`;
  }
  if (pe_ratio != null && pe_ratio > 45) {
    return `P/E ${pe_ratio}x — growth premium priced in`;
  }
  if (trend === "bullish" && return_1m != null && return_1m > 15) {
    return "Extended run — consider waiting for pullback";
  }
  if (trend === "bullish" && above_ema200 === true) {
    return "Above EMA200 — uptrend intact";
  }
  return null;
}
