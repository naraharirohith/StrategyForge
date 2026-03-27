/**
 * Simple Mode Routes — Phase 3
 *
 * Endpoints for the conversational Simple Mode:
 * - POST /api/simple/parse     — Parse free-text into structured intent
 * - POST /api/simple/generate  — Generate strategy from intent (uses template or AI)
 * - POST /api/simple/translate — Translate backtest results to plain English
 * - GET  /api/simple/templates — List available strategy templates
 */

import { Router } from "express";
import { IntentParser, type ParsedIntent } from "../ai/intent-parser.js";
import { translateBacktestResult } from "../ai/result-translator.js";
import { resolveProvider, createGenerator } from "../ai/generator.js";
import { prisma, guestUserId } from "../lib/prisma.js";

export const simpleRouter = Router();

const ENGINE_URL = process.env.ENGINE_URL || "http://localhost:8001";

// ============================================================
// POST /api/simple/parse
// ============================================================

simpleRouter.post("/simple/parse", async (req, res) => {
  try {
    const { input, provider: providerName } = req.body;
    if (!input || typeof input !== "string") {
      res.status(400).json({ success: false, error: "Missing 'input' field" });
      return;
    }

    const provider = resolveProvider(providerName || "gemini");
    const parser = new IntentParser(provider);
    const intent = await parser.parse(input);

    res.json({ success: true, intent });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Intent parsing failed";
    res.status(500).json({ success: false, error: msg });
  }
});

// ============================================================
// POST /api/simple/generate
// ============================================================

simpleRouter.post("/simple/generate", async (req, res) => {
  try {
    const { intent, provider: providerName } = req.body as {
      intent: ParsedIntent;
      provider?: string;
    };

    if (!intent) {
      res.status(400).json({ success: false, error: "Missing 'intent' field" });
      return;
    }

    // If intent maps to a template, use the template (no AI call needed)
    if (intent.suggested_template && !intent.is_expert_input) {
      try {
        const templateRes = await fetch(`${ENGINE_URL}/templates/customize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            template_id: intent.suggested_template,
            market: intent.market,
            capital: intent.capital,
            currency: intent.currency,
            tickers: intent.preferred_tickers?.length ? intent.preferred_tickers : undefined,
          }),
        });
        const templateData = await templateRes.json();

        if (templateData.success && templateData.strategy) {
          // Save to database
          const strategy = templateData.strategy;
          const saved = await prisma.strategy.create({
            data: {
              userId: guestUserId,
              name: strategy.name,
              description: strategy.description ?? "",
              market: (["US", "IN"].includes(strategy.universe?.market) ? strategy.universe.market : "US") as "US" | "IN",
              style: clampStyle(strategy.style),
              riskLevel: clampRisk(strategy.risk_level),
              timeframe: strategy.timeframe || "1d",
              definition: strategy,
            },
          });

          res.json({
            success: true,
            strategy,
            strategyId: saved.id,
            source: "template",
            template_id: intent.suggested_template,
          });
          return;
        }
      } catch {
        // Fall through to AI generation if template fetch fails
      }
    }

    // Build a description from the intent for the expert generator
    const description = intent.expert_description || buildDescriptionFromIntent(intent);
    const name = (providerName || "gemini") as "claude" | "openai" | "openrouter" | "gemini";

    const apiKey =
      name === "claude"
        ? process.env.ANTHROPIC_API_KEY
        : name === "openrouter"
        ? process.env.OPENROUTER_API_KEY
        : name === "gemini"
        ? process.env.GEMINI_API_KEY
        : process.env.OPENAI_API_KEY;

    if (!apiKey) {
      res.status(500).json({ success: false, error: `${name} API key not configured` });
      return;
    }

    const generator = createGenerator({ provider: name, apiKey });
    const strategy = await generator.generate({
      description,
      preferences: buildPreferencesFromIntent(intent),
    });

    // Save to database
    const saved = await prisma.strategy.create({
      data: {
        userId: guestUserId,
        name: strategy.name,
        description: strategy.description ?? "",
        market: (["US", "IN"].includes(strategy.universe?.market) ? strategy.universe.market : "US") as "US" | "IN",
        style: clampStyle(strategy.style),
        riskLevel: clampRisk(strategy.risk_level),
        timeframe: strategy.timeframe || "1d",
        definition: strategy as object,
      },
    });

    res.json({
      success: true,
      strategy,
      strategyId: saved.id,
      source: "ai",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Strategy generation failed";
    res.status(500).json({ success: false, error: msg });
  }
});

// ============================================================
// POST /api/simple/translate
// ============================================================

simpleRouter.post("/simple/translate", async (req, res) => {
  try {
    const { summary, score, currency, timeframe } = req.body;

    if (!summary || !score) {
      res.status(400).json({ success: false, error: "Missing 'summary' or 'score' fields" });
      return;
    }

    const translated = translateBacktestResult(summary, score, currency, timeframe);
    res.json({ success: true, translation: translated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Translation failed";
    res.status(500).json({ success: false, error: msg });
  }
});

// ============================================================
// GET /api/simple/templates
// ============================================================

simpleRouter.get("/simple/templates", async (_req, res) => {
  try {
    const engineRes = await fetch(`${ENGINE_URL}/templates`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await engineRes.json();
    res.json(data);
  } catch {
    // Fallback: return hardcoded template info if engine is down
    res.json({
      success: true,
      templates: [
        { id: "recession_shield", name: "Recession Shield", description: "Protect your capital during market downturns", risk: "low", market: "US", icon: "shield" },
        { id: "balanced_growth", name: "Balanced Growth", description: "Steady growth with diversified large caps", risk: "moderate", market: "US", icon: "trending_up" },
        { id: "momentum_rider", name: "Momentum Rider", description: "Ride strong trends in high-growth stocks", risk: "high", market: "US", icon: "rocket" },
        { id: "dividend_harvester", name: "Dividend Harvester", description: "Income from high-dividend ETFs", risk: "low", market: "US", icon: "payments" },
        { id: "dip_buyer", name: "Dip Buyer", description: "Buy quality stocks on significant pullbacks", risk: "moderate", market: "US", icon: "south_west" },
        { id: "gold_safe_haven", name: "Gold Safe Haven", description: "Capital preservation through gold", risk: "low", market: "US", icon: "diamond" },
        { id: "all_weather", name: "All-Weather", description: "Diversified across stocks, bonds, gold, real estate", risk: "low", market: "US", icon: "umbrella" },
        { id: "nifty_momentum", name: "NIFTY Momentum", description: "Ride momentum in top Indian stocks", risk: "moderate", market: "IN", icon: "trending_up" },
      ],
    });
  }
});

// ============================================================
// Helpers
// ============================================================

const VALID_STYLES = ["momentum", "mean_reversion", "swing", "positional", "intraday", "portfolio", "hybrid"] as const;
const VALID_RISKS = ["conservative", "moderate", "aggressive"] as const;
type DbStyle = (typeof VALID_STYLES)[number];
type DbRisk = (typeof VALID_RISKS)[number];

function clampStyle(raw: unknown): DbStyle {
  return VALID_STYLES.includes(raw as DbStyle) ? (raw as DbStyle) : "hybrid";
}

function clampRisk(raw: unknown): DbRisk {
  // Also map "low"→"conservative", "high"→"aggressive" in case AI returns those
  if (raw === "low") return "conservative";
  if (raw === "high") return "aggressive";
  return VALID_RISKS.includes(raw as DbRisk) ? (raw as DbRisk) : "moderate";
}

function buildDescriptionFromIntent(intent: ParsedIntent): string {
  const parts: string[] = [];

  const riskMap: Record<string, string> = {
    low: "conservative",
    moderate: "moderate",
    high: "aggressive",
  };

  const horizonMap: Record<string, string> = {
    short: "intraday or 1-3 days",
    medium: "1-4 weeks",
    long: "1-6 months",
  };

  if (intent.goal) {
    const goalDescriptions: Record<string, string> = {
      recession_shield: "a defensive strategy to protect capital during downturns",
      capital_preservation: "a conservative strategy focused on preserving capital",
      steady_growth: "a balanced growth strategy with moderate risk",
      aggressive_growth: "an aggressive growth strategy targeting high returns",
      income_generation: "an income-focused strategy using dividend-paying assets",
      sector_bet: "a focused strategy on specific sectors",
      dip_buying: "a mean-reversion strategy buying quality stocks on dips",
      momentum_riding: "a momentum strategy riding strong trends",
      hedging: "a hedging strategy to protect existing positions",
    };
    parts.push(`Create ${goalDescriptions[intent.goal] || "a strategy"}`);
  } else {
    parts.push("Create a trading strategy");
  }

  if (intent.market) {
    parts.push(`for the ${intent.market === "IN" ? "Indian" : "US"} market`);
  }

  if (intent.risk_tolerance) {
    parts.push(`with ${riskMap[intent.risk_tolerance] || "moderate"} risk`);
  }

  if (intent.time_horizon) {
    parts.push(`holding period ${horizonMap[intent.time_horizon] || "1-4 weeks"}`);
  }

  if (intent.capital && intent.currency) {
    const sym = intent.currency === "INR" ? "\u20B9" : "$";
    parts.push(`with starting capital of ${sym}${intent.capital.toLocaleString()}`);
  }

  if (intent.preferred_sectors?.length) {
    parts.push(`focusing on ${intent.preferred_sectors.join(", ")} sectors`);
  }

  if (intent.preferred_tickers?.length) {
    parts.push(`trading ${intent.preferred_tickers.join(", ")}`);
  }

  if (intent.concerns?.length) {
    parts.push(`(concerns: ${intent.concerns.join(", ")})`);
  }

  return parts.join(". ") + ".";
}

function buildPreferencesFromIntent(intent: ParsedIntent): Record<string, unknown> {
  const prefs: Record<string, unknown> = {};

  if (intent.market) prefs.market = intent.market;
  if (intent.currency) prefs.currency = intent.currency;
  if (intent.capital) prefs.capital = intent.capital;

  const riskMap: Record<string, string> = {
    low: "conservative",
    moderate: "moderate",
    high: "aggressive",
  };
  if (intent.risk_tolerance) prefs.risk_level = riskMap[intent.risk_tolerance];

  const horizonMap: Record<string, string> = {
    short: "intraday",
    medium: "1-4 weeks",
    long: "1-6 months",
  };
  if (intent.time_horizon) prefs.holding_period = horizonMap[intent.time_horizon];

  return prefs;
}
