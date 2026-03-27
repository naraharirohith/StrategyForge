"use client";

import { useState, type ComponentProps } from "react";
import { generateStrategy, streamBacktest, getConfidenceScore } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { SimpleMode } from "@/components/simple/SimpleMode";
import { StrategyCard } from "@/components/strategy/StrategyCard";
import { ConfidenceCard } from "@/components/confidence/ConfidenceCard";
import { ScoreCard } from "@/components/score/ScoreCard";
import { MetricsSummary } from "@/components/backtest/MetricsSummary";
import { EquityCurve } from "@/components/backtest/EquityCurve";
import { DrawdownChart } from "@/components/backtest/DrawdownChart";
import { MonthlyReturns } from "@/components/backtest/MonthlyReturns";
import { TradeTable } from "@/components/backtest/TradeTable";
import { MethodologyDisclosure } from "@/components/backtest/MethodologyDisclosure";

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

const FEATURE_TILES = [
  {
    title: "Prompt to strategy",
    body: "Turn plain-language ideas into structured rules with indicators, entries, exits, and position sizing.",
  },
  {
    title: "Research-grade scoring",
    body: "See the backtest score, breakdown, and confidence context instead of relying on raw return alone.",
  },
  {
    title: "Modern market context",
    body: "Blend historical evidence with regime fit, volatility state, and real-time confidence overlays.",
  },
];

const PROVIDERS = [
  { id: "gemini", label: "Gemini Flash", note: "Fast and practical" },
  { id: "openrouter", label: "OpenRouter", note: "Flexible routing" },
  { id: "claude", label: "Claude", note: "Long-form reasoning" },
  { id: "openai", label: "GPT-4o", note: "Balanced premium model" },
];

type Step = "idle" | "generating" | "generated" | "backtesting" | "backtested" | "scoring" | "done";
type AnyObj = Record<string, unknown>;
type StrategyCardData = ComponentProps<typeof StrategyCard>["strategy"];
type ScoreCardData = ComponentProps<typeof ScoreCard>["score"];
type SummaryData = ComponentProps<typeof MetricsSummary>["summary"];
type ConfidenceData = ComponentProps<typeof ConfidenceCard>["confidence"];
type TradeTableData = ComponentProps<typeof TradeTable>["trades"];

function downloadJson(data: AnyObj, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;
}

type Mode = "simple" | "expert";

export default function Home() {
  const [mode, setMode] = useState<Mode>("simple");
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<string>("gemini");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<AnyObj | null>(null);
  const [strategyId, setStrategyId] = useState<string | null>(null);
  const [backtest, setBacktest] = useState<AnyObj | null>(null);
  const [confidence, setConfidence] = useState<AnyObj | null>(null);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const { toast } = useToast();

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
      const message = e instanceof Error ? e.message : "Generation failed";
      setError(message);
      toast(message);
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
          (_stage, message) => setProgressMsg(message),
          (nextResult) => resolve(nextResult as AnyObj),
          (message) => reject(new Error(message)),
        );
      });

      setBacktest(result);
      setProgressMsg(null);
      setStep("backtested");

      setStep("scoring");
      try {
        const score = await getConfidenceScore(strategy, result, strategyId ?? undefined);
        setConfidence(score.confidence ?? score);
      } catch {
        // Confidence is useful but should not block the main experience.
      }
      setStep("done");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Backtest failed";
      setError(message);
      setProgressMsg(null);
      toast(message);
      setStep("generated");
    }
  }

  const isGenerating = step === "generating";
  const isBacktesting = step === "backtesting" || step === "scoring";
  const showStrategy = strategy !== null && step !== "idle" && step !== "generating";
  const showBacktest = backtest !== null && (step === "backtested" || step === "scoring" || step === "done");
  const initialCapital = ((strategy?.backtest_config as AnyObj | undefined)?.initial_capital as number) ?? 100000;
  const currency = ((strategy?.backtest_config as AnyObj | undefined)?.currency as string) ?? "USD";
  const templatesByCategory = SAFE_TEMPLATES.reduce<Record<string, typeof SAFE_TEMPLATES>>((acc, template) => {
    if (!acc[template.category]) acc[template.category] = [];
    acc[template.category].push(template);
    return acc;
  }, {});

  function handleSwitchToExpert(fromStrategy?: AnyObj, fromStrategyId?: string) {
    setMode("expert");
    if (fromStrategy) {
      setStrategy(fromStrategy);
      setStrategyId(fromStrategyId ?? null);
      setStep("generated");
    }
  }

  return (
    <div className="page-shell">
      <section className="glass-panel flex items-center gap-2 p-2">
        <button
          onClick={() => setMode("simple")}
          className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            mode === "simple"
              ? "bg-[color:var(--accent)] text-[color:var(--bg)]"
              : "text-[color:var(--ink-muted)] hover:text-[color:var(--ink-strong)]"
          }`}
        >
          Simple Mode
        </button>
        <button
          onClick={() => setMode("expert")}
          className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            mode === "expert"
              ? "bg-[color:var(--accent)] text-[color:var(--bg)]"
              : "text-[color:var(--ink-muted)] hover:text-[color:var(--ink-strong)]"
          }`}
        >
          Expert Mode
        </button>
      </section>

      {mode === "simple" && (
        <section className="glass-panel min-h-[600px] p-7 sm:p-8">
          <SimpleMode onSwitchToExpert={handleSwitchToExpert} />
        </section>
      )}

      {mode === "expert" && (<>
      <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="glass-panel p-7 sm:p-8">
          <p className="eyebrow">Premium Strategy Lab</p>
          <h1 className="display-title mt-3 max-w-4xl text-5xl sm:text-6xl xl:text-7xl">
            Build sharper trading systems with AI, evidence, and better taste.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-[color:var(--ink-muted)]">
            StrategyForge turns plain-English ideas into structured rules, runs a full backtest, then layers score and confidence so you can judge a system like a research product, not a toy prompt result.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <span className="stat-chip">AI generation</span>
            <span className="stat-chip">Backtest score</span>
            <span className="stat-chip">Live confidence</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURE_TILES.map((tile, index) => (
            <div key={tile.title} className={`soft-panel p-5 ${index === 0 ? "sm:col-span-2" : ""}`}>
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">Capability {index + 1}</p>
              <h2 className="mt-3 text-2xl font-semibold text-[color:var(--ink-strong)]">{tile.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[color:var(--ink-muted)]">{tile.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel p-7 sm:p-8">
        <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
          <div>
            <p className="eyebrow">Expert Mode</p>
            <h2 className="section-title">Describe the system you want to test</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--ink-muted)]">
              Be specific about market, timeframe, indicators, and risk framing. The better the prompt, the more coherent the strategy definition will be.
            </p>

            <div className="mt-6">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Example: Build a daily swing system for US tech using EMA 20/50 trend alignment, MACD confirmation, and ATR-based exits. Moderate risk. Hold for one to three weeks."
                rows={6}
                className="w-full rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 text-sm leading-7 text-[color:var(--ink-strong)] outline-none transition placeholder:text-[color:var(--ink-soft)] focus:border-[color:var(--accent)] focus:bg-white/[0.06]"
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {PROVIDERS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setProvider(item.id)}
                  className={`rounded-full border px-4 py-2 text-left transition ${
                    provider === item.id
                      ? "border-[color:var(--accent)] bg-[color:var(--accent)]/[0.14] text-[color:var(--ink-strong)]"
                      : "border-white/10 bg-white/5 text-[color:var(--ink-muted)] hover:border-white/20 hover:text-[color:var(--ink-strong)]"
                  }`}
                >
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="block text-xs text-[color:var(--ink-soft)]">{item.note}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="soft-panel flex flex-col justify-between p-6">
            <div>
              <p className="eyebrow">Workflow</p>
              <h3 className="mt-3 text-2xl font-semibold text-[color:var(--ink-strong)]">Prompt, test, judge, refine</h3>
              <div className="mt-5 space-y-3">
                {[
                  "Generate a structured strategy definition.",
                  "Run the backtest with realistic date windows.",
                  "Inspect score, confidence, and the trade log.",
                ].map((item, index) => (
                  <div key={item} className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">Step {index + 1}</span>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--ink-muted)]">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating || isBacktesting}
              className="mt-6 rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-[color:var(--bg)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isGenerating ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Generating strategy
                </span>
              ) : (
                "Generate Strategy"
              )}
            </button>
          </div>
        </div>
      </section>

      <section className="glass-panel p-7 sm:p-8">
        <p className="eyebrow">Quick Start</p>
        <h2 className="section-title">Curated templates that are safer to backtest</h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {Object.entries(templatesByCategory).map(([category, templates]) => (
            <div key={category} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">{category}</p>
              <div className="mt-4 flex flex-col gap-2">
                {templates.map((template) => (
                  <button
                    key={template.label}
                    onClick={() => setPrompt(template.value)}
                    className={`rounded-[18px] border px-4 py-3 text-left text-sm transition ${
                      prompt === template.value
                        ? "border-[color:var(--accent)] bg-[color:var(--accent)]/[0.12] text-[color:var(--ink-strong)]"
                        : "border-white/10 bg-[color:var(--bg-strong)]/[0.50] text-[color:var(--ink-muted)] hover:border-white/20 hover:text-[color:var(--ink-strong)]"
                    }`}
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <section className="rounded-[28px] border border-rose-300/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          {error}
        </section>
      )}

      {isBacktesting && (
        <section className="glass-panel px-6 py-8">
          <div className="flex items-center gap-3 text-sm text-[color:var(--ink-muted)]">
            <Spinner className="text-[color:var(--accent)]" />
            {progressMsg || (step === "scoring" ? "Scoring live conditions..." : "Running backtest...")}
          </div>
        </section>
      )}

      {showStrategy && (
        <section className="space-y-3">
          <StrategyCard strategy={strategy as unknown as StrategyCardData} onRunBacktest={handleBacktest} loading={isBacktesting} />
          <div className="flex justify-end">
            <button
              onClick={() => {
                const name = slugify((strategy?.name as string) ?? "strategy");
                downloadJson(strategy!, `${name}.json`);
              }}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--ink-muted)] transition hover:border-white/20 hover:text-[color:var(--ink-strong)]"
            >
              Export JSON
            </button>
          </div>
        </section>
      )}

      {showBacktest && (
        <section className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Backtest Result</p>
              <h2 className="section-title">Evidence, not just a story</h2>
            </div>
            <button
              onClick={() => {
                const name = slugify((strategy?.name as string) ?? "strategy");
                downloadJson(backtest!, `${name}-backtest.json`);
              }}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--ink-muted)] transition hover:border-white/20 hover:text-[color:var(--ink-strong)]"
            >
              Export Results
            </button>
          </div>

          {!!backtest.summary && (backtest.summary as AnyObj).total_trades != null && ((backtest.summary as AnyObj).total_trades as number) < 30 && (
            <div className="rounded-[24px] border border-amber-300/25 bg-amber-500/10 px-5 py-4 text-sm leading-6 text-amber-100">
              Low sample size: only {(backtest.summary as AnyObj).total_trades as number} trades were recorded. Use this result carefully and consider a broader test window or more instruments.
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-3">
            <ScoreCard score={backtest.score as unknown as ScoreCardData} />
            <div className="xl:col-span-2">
              <MetricsSummary summary={backtest.summary as unknown as SummaryData} />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            {confidence ? (
              <ConfidenceCard confidence={confidence as unknown as ConfidenceData} />
            ) : step === "scoring" ? (
              <div className="glass-panel flex items-center justify-center gap-3 p-6 text-sm text-[color:var(--ink-muted)]">
                <Spinner className="text-[color:var(--accent)]" />
                Scoring live conditions...
              </div>
            ) : null}
            <div className="xl:col-span-2">
              <EquityCurve
                equityCurve={backtest.equity_curve as [string, number][]}
                initialCapital={initialCapital}
                currency={currency}
                benchmarkReturnPct={(backtest.summary as AnyObj)?.benchmark_return_percent as number | undefined}
              />
            </div>
          </div>

          <DrawdownChart drawdownCurve={backtest.drawdown_curve as [string, number][]} />
          <MonthlyReturns monthlyReturns={backtest.monthly_returns as { month: string; return_percent: number }[]} />
          <TradeTable trades={backtest.trades as unknown as TradeTableData} currency={currency} />
          <MethodologyDisclosure
            commissionPct={(strategy?.backtest_config as AnyObj | undefined)?.commission_percent as number | undefined}
            slippagePct={(strategy?.backtest_config as AnyObj | undefined)?.slippage_percent as number | undefined}
            currency={currency}
          />
        </section>
      )}
      </>)}
    </div>
  );
}
