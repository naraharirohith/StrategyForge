import { Router } from "express";
import { prisma, guestUserId } from "../lib/prisma.js";

const ENGINE_URL = process.env.ENGINE_URL || "http://localhost:8001";

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

strategiesRouter.post("/strategies/generate", async (req, res) => {
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

strategiesRouter.post("/strategies/backtest", async (req, res) => {
  try {
    const { strategy, strategyId } = req.body;

    if (!strategy) {
      return res.status(400).json({ error: "Strategy definition is required" });
    }

    // Forward to Python engine
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const engineRes = await fetch(`${ENGINE_URL}/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy }),
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

      res.json(data);
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
// Confidence Score
// ============================================================

strategiesRouter.post("/strategies/confidence", async (req, res) => {
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
