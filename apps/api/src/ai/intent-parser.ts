/**
 * Intent Parser — Phase 3.1
 *
 * A fast, lightweight AI call that extracts structured intent from free-text user input.
 * Uses a cheap/fast model (Gemini Flash or Haiku) since this is a structured extraction task.
 *
 * Input:  "I have 5 lakhs and I'm worried about recession"
 * Output: { capital: 500000, currency: "INR", market: "IN", risk_tolerance: "low", ... }
 */

import type { LLMProvider } from "./generator.js";

// ============================================================
// Types
// ============================================================

export interface ParsedIntent {
  capital?: number;
  currency?: "USD" | "INR";
  market?: "US" | "IN";
  risk_tolerance?: "low" | "moderate" | "high";
  goal?: string;
  concerns?: string[];
  time_horizon?: "short" | "medium" | "long";
  preferred_sectors?: string[];
  preferred_tickers?: string[];
  needs_followup: boolean;
  followup_questions?: string[];
  suggested_template?: string;
  is_expert_input: boolean;
  expert_description?: string;
  plain_summary: string;
}

// ============================================================
// System Prompt
// ============================================================

const INTENT_SYSTEM_PROMPT = `You are an intent extraction engine for StrategyForge, a stock strategy platform supporting US and Indian markets.

Your job: Given a user's free-text input, extract their investment intent into structured JSON.

Respond with ONLY a valid JSON object. No markdown, no explanation.

## Rules

1. **Detect market from context clues:**
   - "lakhs", "crore", "rupees", "₹", "NIFTY", "Sensex", ".NS" tickers → market: "IN", currency: "INR"
   - "$", "dollars", "S&P", "NASDAQ", US company names → market: "US", currency: "USD"
   - Default to "US" if unclear

2. **Detect risk tolerance:**
   - Words like "safe", "protect", "worried", "recession", "conservative", "low risk" → "low"
   - Words like "growth", "balanced", "moderate" → "moderate"
   - Words like "aggressive", "high returns", "momentum", "breakout", "YOLO" → "high"
   - Default to "moderate" if unclear

3. **Detect capital:**
   - Parse amounts: "5 lakhs" = 500000, "50k" = 50000, "$10,000" = 10000
   - "1 crore" = 10000000 INR
   - If not mentioned, omit the field

4. **Detect goal:**
   - recession_shield, capital_preservation, steady_growth, aggressive_growth,
     income_generation, sector_bet, dip_buying, momentum_riding, hedging

5. **Detect time horizon:**
   - "day trading", "intraday" → "short"
   - "weeks", "swing", "1-3 months" → "medium"
   - "long term", "years", "retirement" → "long"

6. **Detect expert input:**
   - If the user mentions specific indicators (RSI, EMA, MACD, Bollinger, etc.),
     specific entry/exit rules, or trading jargon → is_expert_input: true
   - Set expert_description to a cleaned version of their input suitable for the expert generator

7. **Suggest a template** when the intent maps clearly to one:
   - recession_shield, balanced_growth, momentum_rider, dividend_harvester,
     dip_buyer, gold_safe_haven, sector_conviction, all_weather

8. **Ask followup questions** (max 2) only when critical info is missing AND would significantly change the strategy. Set needs_followup: true.
   - Don't ask followups if the user gave enough to work with
   - Phrase questions conversationally, not like a form

9. **plain_summary**: A 1-sentence natural-language summary of what you understood.
   Example: "You want to protect ₹5L from a market downturn with low risk over the medium term."

## Output Schema
{
  "capital": number | null,
  "currency": "USD" | "INR" | null,
  "market": "US" | "IN",
  "risk_tolerance": "low" | "moderate" | "high",
  "goal": string,
  "concerns": string[],
  "time_horizon": "short" | "medium" | "long",
  "preferred_sectors": string[],
  "preferred_tickers": string[],
  "needs_followup": boolean,
  "followup_questions": string[],
  "suggested_template": string | null,
  "is_expert_input": boolean,
  "expert_description": string | null,
  "plain_summary": string
}`;

// ============================================================
// Intent Parser
// ============================================================

export class IntentParser {
  private provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  async parse(userInput: string): Promise<ParsedIntent> {
    const raw = await this.provider.generate(INTENT_SYSTEM_PROMPT, userInput);

    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    try {
      const parsed = JSON.parse(cleaned) as ParsedIntent;

      // Ensure required fields have defaults
      parsed.needs_followup = parsed.needs_followup ?? false;
      parsed.is_expert_input = parsed.is_expert_input ?? false;
      parsed.plain_summary = parsed.plain_summary || "I'll create a strategy based on your request.";
      parsed.concerns = parsed.concerns ?? [];
      parsed.preferred_sectors = parsed.preferred_sectors ?? [];
      parsed.preferred_tickers = parsed.preferred_tickers ?? [];
      parsed.followup_questions = parsed.followup_questions ?? [];

      return parsed;
    } catch {
      // If parsing fails, return a minimal intent with the raw input passed through
      return {
        market: "US",
        risk_tolerance: "moderate",
        goal: "custom",
        concerns: [],
        time_horizon: "medium",
        preferred_sectors: [],
        preferred_tickers: [],
        needs_followup: false,
        followup_questions: [],
        is_expert_input: true,
        expert_description: userInput,
        plain_summary: "I'll create a strategy based on your description.",
      };
    }
  }
}
