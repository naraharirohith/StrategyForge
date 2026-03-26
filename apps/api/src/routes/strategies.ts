import { Router } from "express";
import { prisma, guestUserId } from "../lib/prisma.js";
import { generateLimiter, backtestLimiter, confidenceLimiter } from "../middleware/rateLimiter.js";

const ENGINE_URL = process.env.ENGINE_URL || "http://localhost:8001";
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type StrategyLike = Record<string, any>;

const TIMEFRAME_LIMIT_DAYS: Record<string, number> = {
  "5m": 59,
  "15m": 59,
  "1h": 729,
  "4h": 729,
  "1d": 365 * 5,
  "1w": 365 * 10,
};

const DEFAULT_WINDOW_DAYS: Record<string, number> = {
  "5m": 45,
  "15m": 45,
  "1h": 365,
  "4h": 365 * 2,
  "1d": 365 * 5,
  "1w": 365 * 10,
};

const BARS_PER_DAY: Record<string, number> = {
  "5m": 78,
  "15m": 26,
  "1h": 7,
  "4h": 2,
  "1d": 1,
  "1w": 1 / 5,
};

const TIMEFRAME_FALLBACKS: Record<string, string | undefined> = {
  "5m": "15m",
  "15m": "1h",
  "1h": "4h",
  "4h": "1d",
  "1d": undefined,
  "1w": undefined,
};

function cloneStrategy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}

function getIndicatorLookback(indicator: Record<string, any>): number {
  const params = indicator.params ?? {};
  const type = String(indicator.type ?? "").toUpperCase();

  switch (type) {
    case "MACD":
      return Math.max(Number(params.slow ?? 26), Number(params.signal ?? 9)) + 5;
    case "ICHIMOKU":
      return Math.max(
        Number(params.tenkan ?? 9),
        Number(params.kijun ?? 26) * 2,
        Number(params.senkou_b ?? 52) + Number(params.kijun ?? 26),
      );
    case "STOCH":
      return Number(params.k_period ?? 14) + Number(params.d_period ?? 3);
    case "SUPERTREND":
    case "ATR":
    case "ADX":
    case "CCI":
    case "RSI":
    case "WILLIAMS_R":
    case "MFI":
    case "SMA":
    case "EMA":
    case "WMA":
    case "BBANDS":
    case "DONCHIAN":
    case "KELTNER":
    case "VOLUME_SMA":
    case "PRICE_CHANGE_PCT":
    case "HIGH_LOW_RANGE":
      return Number(params.period ?? 20);
    default:
      return 20;
  }
}

function estimateRequiredBars(strategy: StrategyLike): number {
  const indicators = Array.isArray(strategy.indicators) ? strategy.indicators : [];
  const maxLookback = indicators.reduce((max: number, indicator: Record<string, any>) => {
    return Math.max(max, getIndicatorLookback(indicator));
  }, 20);

  return maxLookback + 40;
}

function estimateAvailableBars(timeframe: string, startDate: Date, endDate: Date): number {
  const barsPerDay = BARS_PER_DAY[timeframe] ?? 1;
  return Math.floor(daysBetween(startDate, endDate) * barsPerDay);
}

function normalizeBacktestWindow(strategy: StrategyLike, notes: string[]): StrategyLike {
  const normalized = cloneStrategy(strategy);
  const timeframe = String(normalized.timeframe ?? "1d");
  const limitDays = TIMEFRAME_LIMIT_DAYS[timeframe] ?? TIMEFRAME_LIMIT_DAYS["1d"];
  const defaultDays = DEFAULT_WINDOW_DAYS[timeframe] ?? DEFAULT_WINDOW_DAYS["1d"];
  const today = new Date();

  const currentConfig = (normalized.backtest_config ?? {}) as Record<string, any>;
  const nextConfig = { ...currentConfig };
  let endDate = parseIsoDate(currentConfig.end_date) ?? today;
  if (endDate > today) endDate = today;

  let startDate = parseIsoDate(currentConfig.start_date);
  if (!startDate) {
    startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - defaultDays);
    notes.push(`Set a ${defaultDays}-day lookback for ${timeframe} data.`);
  }

  const requestedDays = daysBetween(startDate, endDate);
  if (requestedDays > limitDays) {
    startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - limitDays);
    notes.push(`Trimmed the backtest window to ${limitDays} days because ${timeframe} data is not reliably available beyond that.`);
  }

  nextConfig.start_date = formatDate(startDate);
  nextConfig.end_date = formatDate(endDate);
  normalized.backtest_config = nextConfig;

  return normalized;
}

function applyBacktestPreflight(strategy: StrategyLike) {
  const notes: string[] = [];
  let adjusted = normalizeBacktestWindow(strategy, notes);

  while (true) {
    const timeframe = String(adjusted.timeframe ?? "1d");
    const config = (adjusted.backtest_config ?? {}) as Record<string, any>;
    const startDate = parseIsoDate(config.start_date) ?? new Date(`${formatDate(new Date())}T00:00:00.000Z`);
    const endDate = parseIsoDate(config.end_date) ?? new Date(`${formatDate(new Date())}T00:00:00.000Z`);
    const requiredBars = estimateRequiredBars(adjusted);
    const availableBars = estimateAvailableBars(timeframe, startDate, endDate);
    const fallback = TIMEFRAME_FALLBACKS[timeframe];

    if (availableBars >= requiredBars || !fallback) {
      return {
        strategy: adjusted,
        notes,
        adjusted: notes.length > 0,
        diagnostics: {
          timeframe,
          required_bars: requiredBars,
          available_bars: availableBars,
          start_date: config.start_date,
          end_date: config.end_date,
        },
      };
    }

    const previousTimeframe = timeframe;
    adjusted = cloneStrategy(adjusted);
    adjusted.timeframe = fallback;
    notes.push(`Switched timeframe from ${previousTimeframe} to ${fallback} so the strategy has enough history for its longest indicator lookback.`);
    adjusted = normalizeBacktestWindow(adjusted, notes);
  }
}

export const strategiesRouter = Router();

// ============================================================
// List Strategies
// ============================================================

strategiesRouter.get("/strategies", async (_req, res) => {
  try {
    const strategies = await prisma.strategy.findMany({
      where: { userId: guestUserId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        market: true,
        style: true,
        riskLevel: true,
        timeframe: true,
        score: true,
        grade: true,
        totalReturn: true,
        sharpeRatio: true,
        maxDrawdown: true,
        createdAt: true,
        definition: true,
      },
    });
    res.json({ success: true, strategies });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ success: false, error: msg });
  }
});

// ============================================================
// Get Strategy by ID
// ============================================================

strategiesRouter.get("/strategies/:id", async (req, res) => {
  try {
    const strategy = await prisma.strategy.findUnique({
      where: { id: req.params.id },
      include: {
        backtestRuns: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { result: true, score: true, grade: true },
        },
      },
    });
    if (!strategy) {
      return res.status(404).json({ success: false, error: "Strategy not found" });
    }
    res.json({ success: true, strategy });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ success: false, error: msg });
  }
});

// ============================================================
// Strategy Generation
// ============================================================

strategiesRouter.post("/strategies/generate", generateLimiter, async (req, res) => {
  const startTime = Date.now();
  type ProviderName = "claude" | "openai" | "gemini" | "openrouter";
  let provider: ProviderName = "gemini";
  let model: string | undefined;
  let description = "";

  try {
    ({ provider = "gemini" as ProviderName, model } = req.body as { provider?: ProviderName; model?: string });
    description = req.body.description;
    const { preferences } = req.body;

    if (!description?.trim()) {
      return res.status(400).json({ error: "Description is required" });
    }

    // Import the generator dynamically
    const { createGenerator } = await import("../ai/generator.js");

    const apiKey =
      provider === "claude"
        ? process.env.ANTHROPIC_API_KEY
        : provider === "openrouter"
        ? process.env.OPENROUTER_API_KEY
        : provider === "gemini"
        ? process.env.GEMINI_API_KEY
        : process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: `${provider} API key not configured` });
    }

    const generator = createGenerator({ provider, apiKey, model });

    let strategy;
    try {
      strategy = await generator.generate({ description, preferences });
    } catch (genErr: unknown) {
      const msg = genErr instanceof Error ? genErr.message : String(genErr);
      console.error("Raw generation error:", msg.substring(0, 1000));
      throw genErr;
    }
    const latencyMs = Date.now() - startTime;

    // Clamp style/riskLevel to valid enum values
    const VALID_STYLES = ["momentum", "mean_reversion", "swing", "positional", "intraday", "portfolio", "hybrid"];
    const VALID_RISKS = ["conservative", "moderate", "aggressive"];
    const dbStyle = VALID_STYLES.includes(strategy.style) ? strategy.style : "hybrid";
    const dbRiskLevel = VALID_RISKS.includes(strategy.risk_level) ? strategy.risk_level : "moderate";

    // Save to database
    const saved = await prisma.strategy.create({
      data: {
        userId: guestUserId,
        name: strategy.name,
        description: strategy.description,
        market: strategy.universe.market as "US" | "IN",
        style: dbStyle as "momentum" | "mean_reversion" | "swing" | "positional" | "intraday" | "portfolio" | "hybrid",
        riskLevel: dbRiskLevel as "conservative" | "moderate" | "aggressive",
        timeframe: strategy.timeframe,
        definition: strategy as object,
      },
    });

    // Log successful generation
    await prisma.generationLog.create({
      data: {
        userId: guestUserId,
        provider,
        model: model ?? "default",
        userInput: description,
        promptHash: strategy.ai_metadata?.prompt_hash ?? "",
        success: true,
        latencyMs: latencyMs,
        strategyId: saved.id,
      },
    });

    res.json({
      success: true,
      strategy: { ...strategy, id: saved.id },
      strategyId: saved.id,
      latency_ms: latencyMs,
      provider,
    });
  } catch (e: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error("Generation error:", e);

    // Log failed generation
    try {
      await prisma.generationLog.create({
        data: {
          userId: guestUserId,
          provider,
          model: model ?? "default",
          userInput: description || "",
          promptHash: "",
          success: false,
          errorMsg,
          latencyMs,
        },
      });
    } catch (logErr) {
      console.error("Failed to write generation log:", logErr);
    }

    res.status(500).json({ error: errorMsg });
  }
});

// ============================================================
// Backtesting
// ============================================================

strategiesRouter.post("/strategies/backtest", backtestLimiter, async (req, res) => {
  try {
    const { strategy, strategyId } = req.body;

    if (!strategy) {
      return res.status(400).json({ error: "Strategy definition is required" });
    }

    const preflight = applyBacktestPreflight(strategy);

    // Forward to Python engine
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const engineRes = await fetch(`${ENGINE_URL}/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy: preflight.strategy }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!engineRes.ok) {
        const errorText = await engineRes.text();
        return res.status(engineRes.status).json({
          success: false,
          error: `Engine error (${engineRes.status}): ${errorText}`,
        });
      }

      const data = await engineRes.json();

      // Persist backtest run and update strategy scores if we have a DB record
      if (strategyId && data.success && data.result) {
        const r = data.result;
        await prisma.backtestRun.create({
          data: {
            strategyId,
            userId: guestUserId,
            status: "COMPLETED",
            result: r as object,
            totalReturn: r.summary.total_return_percent,
            sharpeRatio: r.summary.sharpe_ratio,
            maxDrawdown: r.summary.max_drawdown_percent,
            winRate: r.summary.win_rate,
            profitFactor: r.summary.profit_factor,
            totalTrades: r.summary.total_trades,
            score: r.score.overall,
            grade: r.score.grade,
            completedAt: new Date(),
            durationMs: data.duration_ms,
          },
        });

        await prisma.strategy.update({
          where: { id: strategyId },
          data: {
            score: r.score.overall,
            grade: r.score.grade,
            sharpeRatio: r.summary.sharpe_ratio,
            maxDrawdown: r.summary.max_drawdown_percent,
            totalReturn: r.summary.total_return_percent,
          },
        });
      }

      res.json({
        ...data,
        preflight: {
          adjusted: preflight.adjusted,
          notes: preflight.notes,
          diagnostics: preflight.diagnostics,
        },
      });
    } catch (e: unknown) {
      clearTimeout(timeout);
      if (e instanceof Error && e.name === "AbortError") {
        return res.status(504).json({ success: false, error: "Backtest timed out after 120 seconds" });
      }
      throw e;
    }
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error("Backtest error:", e);
    res.status(500).json({ success: false, error: errorMsg });
  }
});

// ============================================================
// Streaming Backtest (SSE)
// ============================================================

strategiesRouter.post("/strategies/backtest/stream", backtestLimiter, async (req, res) => {
  try {
    const { strategy, strategyId } = req.body;

    if (!strategy) {
      return res.status(400).json({ error: "Strategy definition is required" });
    }

    const preflight = applyBacktestPreflight(strategy);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    if (preflight.adjusted) {
      res.write(`event: progress\ndata: ${JSON.stringify({
        stage: "preflight",
        message: preflight.notes[preflight.notes.length - 1] ?? "Adjusted backtest settings for data availability.",
        percent: 5,
      })}\n\n`);
    }

    let finalResult: Record<string, unknown> | null = null;

    try {
      const engineRes = await fetch(`${ENGINE_URL}/backtest/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy: preflight.strategy }),
        signal: controller.signal,
      });

      if (!engineRes.ok || !engineRes.body) {
        clearTimeout(timeout);
        res.write(`event: error\ndata: ${JSON.stringify({ error: "Engine connection failed" })}\n\n`);
        res.end();
        return;
      }

      // Pipe the stream through, capturing the result event for DB persistence
      const reader = engineRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);

        // Parse SSE events from chunk to capture the final result
        buffer += chunk;
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const lines = part.split("\n");
          let eventName = "";
          let eventData = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventName = line.slice(7);
            } else if (line.startsWith("data: ")) {
              eventData = line.slice(6);
            }
          }
          if (eventName === "result" && eventData) {
            try {
              finalResult = JSON.parse(eventData);
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      clearTimeout(timeout);
    } catch (e: unknown) {
      clearTimeout(timeout);
      const msg =
        e instanceof Error && e.name === "AbortError"
          ? "Backtest timed out"
          : e instanceof Error
            ? e.message
            : String(e);
      res.write(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`);
    }

    res.end();

    // Persist the backtest result to DB after streaming completes
    if (strategyId && finalResult) {
      try {
        const r = finalResult as Record<string, unknown>;
        const summary = r.summary as Record<string, unknown>;
        const score = r.score as Record<string, unknown>;
        await prisma.backtestRun.create({
          data: {
            strategyId,
            userId: guestUserId,
            status: "COMPLETED",
            result: r as object,
            totalReturn: summary.total_return_percent as number,
            sharpeRatio: summary.sharpe_ratio as number,
            maxDrawdown: summary.max_drawdown_percent as number,
            winRate: summary.win_rate as number,
            profitFactor: summary.profit_factor as number,
            totalTrades: summary.total_trades as number,
            score: score.overall as number,
            grade: score.grade as string,
            completedAt: new Date(),
            durationMs: (r.duration_ms as number) ?? null,
          },
        });

        await prisma.strategy.update({
          where: { id: strategyId },
          data: {
            score: score.overall as number,
            grade: score.grade as string,
            sharpeRatio: summary.sharpe_ratio as number,
            maxDrawdown: summary.max_drawdown_percent as number,
            totalReturn: summary.total_return_percent as number,
          },
        });
      } catch (dbErr) {
        console.error("Failed to persist streaming backtest result:", dbErr);
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: msg });
    }
  }
});

// ============================================================
// Delete Strategy
// ============================================================

strategiesRouter.delete("/strategies/:id", async (req, res) => {
  try {
    const strategy = await prisma.strategy.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });

    if (!strategy) {
      return res.status(404).json({ success: false, error: "Strategy not found" });
    }

    if (strategy.userId !== guestUserId) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    // Delete related records first (backtest runs), then the strategy
    await prisma.backtestRun.deleteMany({
      where: { strategyId: req.params.id },
    });

    await prisma.strategy.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ success: false, error: msg });
  }
});

// ============================================================
// Confidence Score
// ============================================================

strategiesRouter.post("/strategies/confidence", confidenceLimiter, async (req, res) => {
  try {
    const { strategy, backtest_result, strategyId } = req.body;
    if (!strategy || !backtest_result) {
      return res.status(400).json({ error: "strategy and backtest_result are required" });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const engineRes = await fetch(`${ENGINE_URL}/confidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy, latest_backtest: backtest_result }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!engineRes.ok) {
        const errorText = await engineRes.text();
        return res.status(engineRes.status).json({
          success: false,
          error: `Engine error (${engineRes.status}): ${errorText}`,
        });
      }

      const result = await engineRes.json();

      // Persist confidence score to the database if strategyId is provided
      if (strategyId && result.success && result.confidence) {
        try {
          await prisma.strategy.update({
            where: { id: strategyId },
            data: {
              confidenceScore: result.confidence.overall,
              confidenceData: result.confidence as object,
              confidenceUpdatedAt: new Date(),
            },
          });
        } catch (dbErr) {
          console.error("Failed to persist confidence score:", dbErr);
          // Don't fail the request if DB write fails
        }
      }

      res.json(result);
    } catch (e: unknown) {
      clearTimeout(timeout);
      if (e instanceof Error && e.name === "AbortError") {
        return res.status(504).json({ success: false, error: "Confidence scoring timed out after 120 seconds" });
      }
      throw e;
    }
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ success: false, error: errorMsg });
  }
});
