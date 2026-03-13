import type {
  StrategyDefinition,
  UserStrategyInput,
  IndicatorType,
} from "@strategyforge/types";

// ============================================================
// LLM Provider Interface — model-agnostic
// ============================================================

export interface LLMProvider {
  name: string;
  generate(systemPrompt: string, userPrompt: string): Promise<string>;
}

// ============================================================
// Claude Adapter
// ============================================================

export class ClaudeProvider implements LLMProvider {
  name = "claude";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "claude-sonnet-4-20250514") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`Claude API error: ${data.error.message}`);
    return data.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");
  }
}

// ============================================================
// OpenAI Adapter
// ============================================================

export class OpenAIProvider implements LLMProvider {
  name = "openai";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "gpt-4o") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`OpenAI API error: ${data.error.message}`);
    return data.choices[0].message.content;
  }
}

// ============================================================
// System Prompt — The core instruction set for strategy generation
// ============================================================

const SYSTEM_PROMPT = `You are StrategyForge AI, an expert quantitative strategist. Your job is to generate executable trading strategies based on user requirements.

You MUST respond with ONLY a valid JSON object conforming to the StrategyDefinition schema. No markdown, no backticks, no explanation outside the JSON.

## Schema Rules

1. **schema_version**: Always "1.0.0"
2. **universe**: Must include market ("US" or "IN"), asset_class, and either tickers[] or selection_criteria
   - US tickers: plain symbols like "AAPL", "MSFT", "SPY"
   - Indian tickers: append ".NS" for NSE, ".BO" for BSE (e.g., "RELIANCE.NS", "TCS.NS")
   - Index tickers: "^NSEI" (NIFTY50), "^NSEBANK" (BANKNIFTY), "^GSPC" (S&P500), "^IXIC" (NASDAQ)
3. **indicators**: Each must have a unique id, valid type, and params. Common configs:
   - SMA/EMA: { period: N }
   - RSI: { period: 14 }
   - MACD: { fast: 12, slow: 26, signal: 9 }
   - BBANDS: { period: 20, std_dev: 2 }
   - ATR: { period: 14 }
   - ADX: { period: 14 }
   - SUPERTREND: { period: 10, multiplier: 3 }
   - STOCH: { k_period: 14, d_period: 3 }
4. **entry_rules**: At least one. Each needs conditions (ConditionGroup with AND/OR logic), position_sizing, and side ("long"/"short"/"both")
5. **exit_rules**: MUST include at least one stop_loss (priority 1). Take profit and other exits optional but recommended
6. **risk_management**: Always include max_portfolio_drawdown_percent and max_position_count
7. **backtest_config**: Default to initial_capital 100000, commission 0.1%, slippage 0.05%
   - Use currency "INR" for Indian market, "USD" for US
   - For Indian market: commission should be 0.03% (Zerodha-like) + STT/charges approximated as 0.1% total

## Strategy Quality Guidelines

- **Conservative risk**: max 2% risk per trade, max 5 positions, stop loss within 3-5%
- **Moderate risk**: max 3-5% risk per trade, max 8 positions, stop loss within 5-8%
- **Aggressive risk**: max 5-10% risk per trade, max 12 positions, stop loss within 8-15%
- Always include a trailing stop or time-based exit to prevent indefinite holds
- For intraday strategies, include time_filter with entry_before and no_entry_before_close_minutes
- For Indian market, respect trading hours 09:15-15:30 IST
- For US market, respect trading hours 09:30-16:00 ET
- Include at least 2-3 indicators for entry conditions (single indicator strategies are fragile)
- Use cooldown_bars to prevent overtrading (minimum 3 bars for intraday, 1 bar for daily)

## Description Quality

The "description" field should explain the strategy in plain English:
- What market conditions it targets
- Why this combination of indicators works
- Expected behavior in different market regimes
- Key risks the user should be aware of

## Example indicator condition patterns:

Golden Cross: EMA(50) crosses_above EMA(200) → bullish entry
RSI Oversold Bounce: RSI(14) crosses_above 30 AND price > SMA(200) → mean reversion long
MACD Divergence: MACD histogram > 0 AND MACD crosses_above signal line → momentum entry
Bollinger Squeeze: Price crosses_below BBANDS lower AND RSI < 35 → mean reversion entry
Supertrend Flip: Supertrend changes direction → trend following entry/exit`;

// ============================================================
// User Prompt Builder
// ============================================================

function buildUserPrompt(input: UserStrategyInput): string {
  let prompt = `Generate a trading strategy based on this request:\n\n`;
  prompt += `"${input.description}"\n\n`;

  if (input.preferences) {
    prompt += `User preferences:\n`;
    const p = input.preferences;
    if (p.market) prompt += `- Market: ${p.market === "US" ? "US stocks" : "Indian stocks (NSE/BSE)"}\n`;
    if (p.risk_level) prompt += `- Risk level: ${p.risk_level}\n`;
    if (p.style) prompt += `- Strategy style: ${p.style}\n`;
    if (p.timeframe) prompt += `- Timeframe: ${p.timeframe}\n`;
    if (p.capital) prompt += `- Starting capital: ${p.currency === "INR" ? "₹" : "$"}${p.capital.toLocaleString()}\n`;
    if (p.max_positions) prompt += `- Max positions: ${p.max_positions}\n`;
    if (p.preferred_indicators?.length) prompt += `- Preferred indicators: ${p.preferred_indicators.join(", ")}\n`;
    if (p.avoid_sectors?.length) prompt += `- Avoid sectors: ${p.avoid_sectors.join(", ")}\n`;
    if (p.holding_period) prompt += `- Holding period: ${p.holding_period}\n`;
  }

  prompt += `\nRespond with ONLY the JSON strategy definition. No other text.`;
  return prompt;
}

// ============================================================
// Strategy Generator — Main class
// ============================================================

export class StrategyGenerator {
  private provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  /**
   * Generate a strategy from user input
   */
  async generate(input: UserStrategyInput): Promise<StrategyDefinition> {
    const userPrompt = buildUserPrompt(input);
    const raw = await this.provider.generate(SYSTEM_PROMPT, userPrompt);

    // Parse and validate
    const strategy = this.parseStrategy(raw);
    this.validate(strategy);

    // Attach AI metadata
    strategy.ai_metadata = {
      model_used: this.provider.name,
      prompt_hash: this.hashString(userPrompt),
      generation_timestamp: new Date().toISOString(),
      user_input_summary: input.description,
      confidence_notes: strategy.description,
    };

    return strategy;
  }

  /**
   * Parse JSON from LLM response (handles markdown fences)
   */
  private parseStrategy(raw: string): StrategyDefinition {
    let cleaned = raw.trim();
    // Strip markdown code fences if present
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      throw new Error(`Failed to parse strategy JSON: ${(e as Error).message}\n\nRaw response:\n${raw.substring(0, 500)}`);
    }
  }

  /**
   * Validate strategy meets minimum requirements
   */
  private validate(strategy: StrategyDefinition): void {
    const errors: string[] = [];

    if (strategy.schema_version !== "1.0.0") {
      errors.push("Invalid schema_version (must be '1.0.0')");
    }
    if (!strategy.name?.trim()) {
      errors.push("Strategy name is required");
    }
    if (!strategy.universe?.market) {
      errors.push("Universe market is required");
    }
    if (!strategy.universe?.tickers?.length && !strategy.universe?.selection_criteria) {
      errors.push("Universe must have tickers or selection_criteria");
    }
    if (!strategy.indicators?.length) {
      errors.push("At least one indicator is required");
    }
    if (!strategy.entry_rules?.length) {
      errors.push("At least one entry rule is required");
    }
    if (!strategy.exit_rules?.length) {
      errors.push("At least one exit rule is required");
    }

    // Check for mandatory stop loss
    const hasStopLoss = strategy.exit_rules?.some((r) => r.type === "stop_loss");
    if (!hasStopLoss) {
      errors.push("A stop_loss exit rule is mandatory");
    }

    // Check risk management
    if (!strategy.risk_management) {
      errors.push("Risk management configuration is required");
    }

    // Check backtest config
    if (!strategy.backtest_config?.initial_capital) {
      errors.push("Backtest initial_capital is required");
    }

    if (errors.length > 0) {
      throw new Error(`Strategy validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
    }
  }

  /**
   * Simple string hash for prompt tracking
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, "0");
  }
}

// ============================================================
// Factory — Convenience function
// ============================================================

export function createGenerator(config: {
  provider: "claude" | "openai";
  apiKey: string;
  model?: string;
}): StrategyGenerator {
  const provider =
    config.provider === "claude"
      ? new ClaudeProvider(config.apiKey, config.model)
      : new OpenAIProvider(config.apiKey, config.model);
  return new StrategyGenerator(provider);
}
