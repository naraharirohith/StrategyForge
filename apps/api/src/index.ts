import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config();

const app = express();

// Initialize Prisma with Postgres adapter
const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
const PORT = process.env.PORT || 3001;
const ENGINE_URL = process.env.ENGINE_URL || "http://localhost:8001";

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ============================================================
// Guest user — used for all saves until auth is added
// ============================================================

let guestUserId: string;

async function ensureGuestUser() {
  const guest = await prisma.user.upsert({
    where: { email: "guest@strategyforge.local" },
    update: {},
    create: { email: "guest@strategyforge.local", name: "Guest" },
  });
  guestUserId = guest.id;
}

// ============================================================
// Health
// ============================================================

app.get("/api/health", async (_req, res) => {
  try {
    // Check engine health
    const engineRes = await fetch(`${ENGINE_URL}/health`);
    const engineHealth = await engineRes.json();
    res.json({
      status: "ok",
      api_version: "0.1.0",
      engine: engineHealth,
      database: "connected",
    });
  } catch (e) {
    res.json({
      status: "degraded",
      api_version: "0.1.0",
      engine: "unreachable",
      database: "connected",
    });
  }
});

// ============================================================
// Strategy Generation
// ============================================================

app.post("/api/strategies/generate", async (req, res) => {
  try {
    const { description, preferences, provider = "gemini", model } = req.body;

    if (!description?.trim()) {
      return res.status(400).json({ error: "Description is required" });
    }

    // Import the generator dynamically
    const { createGenerator } = await import("./ai/generator.js");

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

    const startTime = Date.now();
    let strategy;
    try {
      strategy = await generator.generate({ description, preferences });
    } catch (genErr: any) {
      console.error("Raw generation error:", genErr.message.substring(0, 1000));
      throw genErr;
    }
    const latencyMs = Date.now() - startTime;

    // Save to database
    const saved = await prisma.strategy.create({
      data: {
        userId: guestUserId,
        name: strategy.name,
        description: strategy.description,
        market: strategy.universe.market as "US" | "IN",
        style: strategy.style as any,
        riskLevel: strategy.risk_level as any,
        timeframe: strategy.timeframe,
        definition: strategy as any,
      },
    });

    res.json({
      success: true,
      strategy: { ...strategy, id: saved.id },
      strategyId: saved.id,
      latency_ms: latencyMs,
      provider,
    });
  } catch (e: any) {
    console.error("Generation error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// Backtesting
// ============================================================

app.post("/api/strategies/backtest", async (req, res) => {
  try {
    const { strategy, strategyId } = req.body;

    if (!strategy) {
      return res.status(400).json({ error: "Strategy definition is required" });
    }

    // Forward to Python engine
    const engineRes = await fetch(`${ENGINE_URL}/backtest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy }),
    });

    const data = await engineRes.json();

    // Persist backtest run and update strategy scores if we have a DB record
    if (strategyId && data.success && data.result) {
      const r = data.result;
      await prisma.backtestRun.create({
        data: {
          strategyId,
          userId: guestUserId,
          status: "COMPLETED",
          result: r as any,
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
  } catch (e: any) {
    console.error("Backtest error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============================================================
// Confidence Score
// ============================================================

app.post("/api/strategies/confidence", async (req, res) => {
  try {
    const { strategy, backtest_result } = req.body;
    if (!strategy || !backtest_result) {
      return res.status(400).json({ error: "strategy and backtest_result are required" });
    }
    const engineRes = await fetch(`${ENGINE_URL}/confidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy, latest_backtest: backtest_result }),
    });
    const result = await engineRes.json();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============================================================
// Marketplace — Browse strategies
// ============================================================

app.get("/api/marketplace", async (req, res) => {
  try {
    const {
      market,
      style,
      risk_level,
      min_score,
      sort_by = "score",
      page = "1",
      limit = "20",
    } = req.query;

    const where: any = { isPublished: true };
    if (market) where.market = market;
    if (style) where.style = style;
    if (risk_level) where.riskLevel = risk_level;
    if (min_score) where.score = { gte: parseFloat(min_score as string) };

    const orderBy: any = {};
    if (sort_by === "score") orderBy.score = "desc";
    else if (sort_by === "return") orderBy.totalReturn = "desc";
    else if (sort_by === "newest") orderBy.publishedAt = "desc";

    const strategies = await prisma.strategy.findMany({
      where,
      orderBy,
      take: parseInt(limit as string),
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        _count: { select: { subscriptions: true } },
      },
    });

    const total = await prisma.strategy.count({ where });

    res.json({
      strategies,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (e: any) {
    console.error("Marketplace error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// Start
// ============================================================

ensureGuestUser()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`StrategyForge API running on port ${PORT}`);
      console.log(`Engine URL: ${ENGINE_URL}`);
    });
  })
  .catch((e) => {
    console.error("Failed to initialize guest user:", e);
    process.exit(1);
  });


