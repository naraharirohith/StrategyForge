import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const ENGINE_URL = process.env.ENGINE_URL || "http://localhost:8001";

app.use(cors());
app.use(express.json({ limit: "10mb" }));

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
    const { description, preferences, provider = "claude" } = req.body;

    if (!description?.trim()) {
      return res.status(400).json({ error: "Description is required" });
    }

    // Import the generator dynamically
    const { createGenerator } = await import("./ai/generator.js");

    const apiKey =
      provider === "claude"
        ? process.env.ANTHROPIC_API_KEY
        : process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: `${provider} API key not configured` });
    }

    const generator = createGenerator({ provider, apiKey });

    const startTime = Date.now();
    const strategy = await generator.generate({ description, preferences });
    const latencyMs = Date.now() - startTime;

    // Save to database
    // const saved = await prisma.strategy.create({ ... });

    res.json({
      success: true,
      strategy,
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
    const { strategy } = req.body;

    if (!strategy) {
      return res.status(400).json({ error: "Strategy definition is required" });
    }

    // Forward to Python engine
    const engineRes = await fetch(`${ENGINE_URL}/backtest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy }),
    });

    const result = await engineRes.json();
    res.json(result);
  } catch (e: any) {
    console.error("Backtest error:", e);
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

app.listen(PORT, () => {
  console.log(`StrategyForge API running on port ${PORT}`);
  console.log(`Engine URL: ${ENGINE_URL}`);
});
