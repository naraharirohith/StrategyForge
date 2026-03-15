const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function generateStrategy(
  description: string,
  preferences?: Record<string, unknown>
) {
  const res = await fetch(`${API_URL}/api/strategies/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description, preferences, provider: "gemini" }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Generation failed");
  return data;
}

export async function runBacktest(
  strategy: Record<string, unknown>,
  strategyId?: string
) {
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  const strategyWithDates = {
    ...strategy,
    backtest_config: {
      ...(strategy.backtest_config as Record<string, unknown>),
      start_date: fiveYearsAgo.toISOString().split("T")[0],
      end_date: new Date().toISOString().split("T")[0],
    },
  };

  const res = await fetch(`${API_URL}/api/strategies/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ strategy: strategyWithDates, strategyId }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Backtest failed");
  return data;
}

export async function getConfidenceScore(
  strategy: Record<string, unknown>,
  backtestResult: Record<string, unknown>
) {
  const res = await fetch(`${API_URL}/api/strategies/confidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ strategy, backtest_result: backtestResult }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Confidence scoring failed");
  return data;
}
