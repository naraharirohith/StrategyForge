/**
 * Result Translator — Phase 3.3
 *
 * Converts backtest metrics into plain-English summaries for Simple Mode users.
 * No AI call needed — rule-based translation is faster, cheaper, and deterministic.
 */

interface BacktestSummary {
  total_return_percent: number;
  annualized_return_percent: number;
  sharpe_ratio: number;
  max_drawdown_percent: number;
  total_trades: number;
  winning_trades: number;
  win_rate: number;
  profit_factor: number;
  avg_holding_bars: number;
  benchmark_return_percent: number;
  alpha: number;
}

interface StrategyScore {
  overall: number;
  grade: string;
}

interface TranslatedResult {
  headline: string;
  verdict: "great" | "good" | "okay" | "poor";
  bullets: string[];
  risk_warning: string;
  comparison: string;
  suggestion: string;
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fmtRatio(n: number): string {
  return n.toFixed(2);
}

function gradeToVerdict(grade: string): "great" | "good" | "okay" | "poor" {
  if (grade === "S" || grade === "A") return "great";
  if (grade === "B") return "good";
  if (grade === "C") return "okay";
  return "poor";
}

function describeReturn(annualized: number, currency: string): string {
  const amt = currency === "INR" ? "1,00,000" : "100,000";
  const sym = currency === "INR" ? "\u20B9" : "$";
  const finalVal = Math.round(100000 * (1 + annualized / 100));
  const formatted = currency === "INR"
    ? finalVal.toLocaleString("en-IN")
    : finalVal.toLocaleString("en-US");

  if (annualized > 20) return `Strong returns of ${fmtPct(annualized)} per year. ${sym}${amt} would have grown to ~${sym}${formatted} in one year.`;
  if (annualized > 10) return `Solid returns of ${fmtPct(annualized)} per year. ${sym}${amt} would have grown to ~${sym}${formatted} in one year.`;
  if (annualized > 0) return `Modest returns of ${fmtPct(annualized)} per year. ${sym}${amt} would have grown to ~${sym}${formatted} in one year.`;
  return `Negative returns of ${fmtPct(annualized)} per year. This strategy lost money in the test period.`;
}

function describeDrawdown(dd: number): string {
  const absDd = Math.abs(dd);
  if (absDd < 5) return `Very low risk — the worst dip was only ${absDd.toFixed(1)}%.`;
  if (absDd < 10) return `Low risk — the biggest dip from peak was ${absDd.toFixed(1)}%.`;
  if (absDd < 20) return `Moderate risk — at the worst point, the portfolio dipped ${absDd.toFixed(1)}% from its peak.`;
  if (absDd < 30) return `Significant risk — the portfolio once dropped ${absDd.toFixed(1)}% from its peak. You'd need to be comfortable with temporary losses.`;
  return `High risk — the portfolio once dropped ${absDd.toFixed(1)}% from its peak. This requires strong conviction to hold through.`;
}

function describeWinRate(wr: number, totalTrades: number): string {
  if (totalTrades < 10) return `Only ${totalTrades} trades were made — too few to draw reliable conclusions.`;
  const pct = (wr * 100).toFixed(0);
  if (wr > 0.6) return `${pct}% of trades were profitable — good consistency across ${totalTrades} trades.`;
  if (wr > 0.45) return `${pct}% of trades were profitable — average hit rate across ${totalTrades} trades. The winners need to be bigger than the losers.`;
  return `Only ${pct}% of trades were profitable (${totalTrades} total). This strategy relies on big winners to offset frequent small losses.`;
}

function describeBenchmark(alpha: number, benchReturn: number): string {
  if (alpha > 5) return `Beat buy-and-hold by ${fmtPct(alpha)} — the strategy added real value over simply holding.`;
  if (alpha > 0) return `Slightly outperformed buy-and-hold (${fmtPct(benchReturn)}) by ${fmtPct(alpha)}.`;
  if (alpha > -5) return `Roughly matched buy-and-hold performance (${fmtPct(benchReturn)}).`;
  return `Underperformed buy-and-hold (${fmtPct(benchReturn)}) by ${fmtPct(Math.abs(alpha))}. Simply holding would have been better.`;
}

function describeHolding(avgBars: number, timeframe: string): string {
  if (timeframe === "1d") {
    if (avgBars < 5) return `Trades last ~${Math.round(avgBars)} days on average — quick in and out.`;
    if (avgBars < 20) return `Trades last ~${Math.round(avgBars)} days on average — typical swing trade duration.`;
    return `Trades last ~${Math.round(avgBars)} days on average — longer-term holds.`;
  }
  return `Trades last ~${Math.round(avgBars)} bars on average.`;
}

export function translateBacktestResult(
  summary: BacktestSummary,
  score: StrategyScore,
  currency: string = "USD",
  timeframe: string = "1d",
): TranslatedResult {
  const verdict = gradeToVerdict(score.grade);

  const headlines: Record<typeof verdict, string> = {
    great: `This strategy performed well — Grade ${score.grade} (${score.overall}/100)`,
    good: `Decent performance — Grade ${score.grade} (${score.overall}/100)`,
    okay: `Mixed results — Grade ${score.grade} (${score.overall}/100)`,
    poor: `Weak performance — Grade ${score.grade} (${score.overall}/100)`,
  };

  const bullets = [
    describeReturn(summary.annualized_return_percent, currency),
    describeDrawdown(summary.max_drawdown_percent),
    describeWinRate(summary.win_rate, summary.total_trades),
    describeBenchmark(summary.alpha, summary.benchmark_return_percent),
    describeHolding(summary.avg_holding_bars, timeframe),
  ];

  let risk_warning = "Past performance does not guarantee future results. Markets can behave very differently in the future.";
  if (summary.total_trades < 30) {
    risk_warning = `Warning: Only ${summary.total_trades} trades in this backtest. Results with fewer than 30 trades are not statistically reliable. ${risk_warning}`;
  }

  const comparison = summary.sharpe_ratio > 1
    ? `Risk-adjusted return (Sharpe ${fmtRatio(summary.sharpe_ratio)}) is above average — the returns justify the risk taken.`
    : summary.sharpe_ratio > 0.5
      ? `Risk-adjusted return (Sharpe ${fmtRatio(summary.sharpe_ratio)}) is fair — returns are reasonable for the risk.`
      : `Risk-adjusted return (Sharpe ${fmtRatio(summary.sharpe_ratio)}) is weak — you're taking more risk than the returns justify.`;

  let suggestion: string;
  if (verdict === "great") {
    suggestion = "This strategy shows strong potential. Consider saving it and monitoring its live confidence score over time.";
  } else if (verdict === "good") {
    suggestion = "This strategy is promising but has room for improvement. Try adjusting the stop loss or adding more tickers for diversification.";
  } else if (verdict === "okay") {
    suggestion = "Consider trying a different approach — perhaps a different risk level, more tickers, or a different time horizon.";
  } else {
    suggestion = "This strategy needs significant improvement. Try a completely different approach, or start with one of our pre-built templates.";
  }

  return {
    headline: headlines[verdict],
    verdict,
    bullets,
    risk_warning,
    comparison,
    suggestion,
  };
}
