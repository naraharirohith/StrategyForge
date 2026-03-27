const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function buildBacktestWindow(strategy: Record<string, unknown>) {
  const timeframe = String(strategy.timeframe ?? "1d");
  const endDate = new Date();
  const startDate = new Date(endDate);

  const windowDaysByTimeframe: Record<string, number> = {
    "5m": 45,
    "15m": 45,
    "1h": 365,
    "4h": 365 * 2,
    "1d": 365 * 5,
    "1w": 365 * 10,
  };

  startDate.setDate(startDate.getDate() - (windowDaysByTimeframe[timeframe] ?? windowDaysByTimeframe["1d"]));

  return {
    start_date: startDate.toISOString().split("T")[0],
    end_date: endDate.toISOString().split("T")[0],
  };
}

function withBacktestWindow(strategy: Record<string, unknown>) {
  return {
    ...strategy,
    backtest_config: {
      ...(strategy.backtest_config as Record<string, unknown>),
      ...buildBacktestWindow(strategy),
    },
  };
}

export async function generateStrategy(
  description: string,
  preferences?: Record<string, unknown>,
  provider: string = "gemini"
) {
  const res = await fetch(`${API_URL}/api/strategies/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description, preferences, provider }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Generation failed");
  return data;
}

export async function runBacktest(
  strategy: Record<string, unknown>,
  strategyId?: string
) {
  const strategyWithDates = withBacktestWindow(strategy);

  const res = await fetch(`${API_URL}/api/strategies/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ strategy: strategyWithDates, strategyId }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Backtest failed");
  return data;
}

export async function getStrategy(id: string) {
  const res = await fetch(`${API_URL}/api/strategies/${id}`);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Failed to load strategy");
  return data;
}

export async function getStrategies() {
  const res = await fetch(`${API_URL}/api/strategies`);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Failed to load strategies");
  return data;
}

export async function deleteStrategy(id: string) {
  const res = await fetch(`${API_URL}/api/strategies/${id}`, {
    method: "DELETE",
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Failed to delete strategy");
  return data;
}

export function streamBacktest(
  strategy: Record<string, unknown>,
  strategyId: string | undefined,
  onProgress: (stage: string, message: string, percent: number) => void,
  onResult: (result: Record<string, unknown>) => void,
  onError: (error: string) => void,
): () => void {
  const controller = new AbortController();
  const strategyWithDates = withBacktestWindow(strategy);

  fetch(`${API_URL}/api/strategies/backtest/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ strategy: strategyWithDates, strategyId }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok || !res.body) {
        onError("Failed to connect to backtest stream");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const lines = part.split("\n");
          let currentEvent = "";
          let currentData = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7);
            } else if (line.startsWith("data: ")) {
              currentData = line.slice(6);
            }
          }

          if (currentEvent && currentData) {
            try {
              const parsed = JSON.parse(currentData);
              if (currentEvent === "progress") {
                onProgress(parsed.stage, parsed.message, parsed.percent ?? 0);
              } else if (currentEvent === "result") {
                onResult(parsed);
              } else if (currentEvent === "error") {
                onError(parsed.error);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    })
    .catch((e) => {
      if (e.name !== "AbortError") {
        onError(e.message || "Stream connection failed");
      }
    });

  // Return abort function
  return () => controller.abort();
}

export async function getConfidenceScore(
  strategy: Record<string, unknown>,
  backtestResult: Record<string, unknown>,
  strategyId?: string
) {
  const res = await fetch(`${API_URL}/api/strategies/confidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ strategy, backtest_result: backtestResult, strategyId }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Confidence scoring failed");
  return data;
}
