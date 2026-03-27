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

You will receive MARKET CONTEXT and RECENT NEWS before the user's request. USE this context to:
- Select appropriate tickers (favor sectors/stocks with momentum aligned to the strategy style)
- Choose indicators suited to the current market regime (trending → trend-following, range-bound → mean-reversion)
- Set realistic stop-loss levels based on current volatility (wider in high-VIX, tighter in low-VIX)
- Mention current market conditions in the strategy description to show awareness
- If no market context is provided, generate based on the user's request alone

You MUST respond with ONLY a valid JSON object conforming to the StrategyDefinition schema. No markdown, no backticks, no explanation outside the JSON.

## Schema Rules

1. **schema_version**: Always "1.0.0"
2. **universe**: Must include market ("US" or "IN"), asset_class, and a tickers[] array (REQUIRED — never use selection_criteria)
   - US tickers: plain symbols like "AAPL", "MSFT", "SPY"
   - Indian tickers: ALWAYS append ".NS" suffix (e.g., "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS")
   - For NIFTY50 strategies pick 4-6 top NIFTY50 stocks with .NS suffix — do NOT use index symbols as the strategy ticker
   - Index tickers for reference only: "^NSEI" (NIFTY50), "^GSPC" (S&P500)
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
- Prefer "1d" timeframe unless the user explicitly asks for intraday or hourly trading
- For 5m or 15m strategies, NEVER use indicator lookbacks above 100 bars
- For 1h strategies, avoid lookbacks above 200 bars
- If a requested setup needs very long lookbacks (for example EMA 200, SMA 200, or Ichimoku), prefer 1d timeframe instead of intraday data

## Description Quality

The "description" field should explain the strategy in plain English:
- What market conditions it targets
- Why this combination of indicators works
- Expected behavior in different market regimes
- Key risks the user should be aware of

## EXACT JSON Structure — copy this format precisely

### entry_rules conditions MUST use this exact structure:
"conditions": {
  "logic": "AND",
  "conditions": [
    { "id": "c1", "left": { "type": "indicator", "indicator_id": "ema_50" }, "operator": "crosses_above", "right": { "type": "indicator", "indicator_id": "ema_200" } },
    { "id": "c2", "left": { "type": "indicator", "indicator_id": "rsi_14" }, "operator": "lt", "right": { "type": "constant", "value": 60 } }
  ]
}
CRITICAL: use "logic" NOT "type". Use "conditions" array NOT "rules" array.
Each condition MUST have "left" and "right" objects with "type" field. NOT "indicator_id" at top level.

### position_sizing MUST use this exact structure:
"position_sizing": { "method": "percent_of_portfolio", "percent": 10 }
CRITICAL: use "method" NOT "type". Use "percent_of_portfolio" NOT "percentage_of_capital".

### exit_rules — "value" is always a top-level number, NEVER nested in "params":
{ "id": "sl", "name": "Stop Loss", "type": "stop_loss", "value": 5, "priority": 1 }
{ "id": "tp", "name": "Take Profit", "type": "take_profit", "value": 15, "priority": 2 }
{ "id": "tr", "name": "Trailing Stop", "type": "trailing_stop", "value": 8, "priority": 3 }
{ "id": "tb", "name": "Time Exit", "type": "time_based", "value": 10, "priority": 4 }

### backtest_config MUST use "commission_percent" and "slippage_percent" (NOT "commission" or "slippage"):
"backtest_config": { "initial_capital": 100000, "currency": "USD", "commission_percent": 0.1, "slippage_percent": 0.05 }

## Example condition patterns:

Golden Cross: EMA(50) crosses_above EMA(200) → left: {type:indicator, indicator_id:ema_50}, operator: crosses_above, right: {type:indicator, indicator_id:ema_200}
RSI threshold: RSI < 30 → left: {type:indicator, indicator_id:rsi_14}, operator: lt, right: {type:constant, value:30}
Price vs indicator: Close > SMA(200) → left: {type:price, field:close}, operator: gt, right: {type:indicator, indicator_id:sma_200}`;

// ============================================================
// Market Context Fetcher
// ============================================================

const ENGINE_URL = process.env.ENGINE_URL || "http://localhost:8001";

interface MarketContext {
  marketPrompt: string;
  newsHeadlines: string[];
}

async function fetchMarketContext(market: string = "US"): Promise<MarketContext> {
  const result: MarketContext = { marketPrompt: "", newsHeadlines: [] };

  // Fetch market snapshot prompt text from engine
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(
      `${ENGINE_URL}/market-snapshot/prompt?market=${encodeURIComponent(market)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    const data = await res.json();
    if (data.success && data.prompt_context) {
      result.marketPrompt = data.prompt_context;
    }
  } catch (e) {
    console.warn("Market snapshot fetch failed (non-fatal):", (e as Error).message);
  }

  // Fetch news headlines from engine
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(
      `${ENGINE_URL}/news?market=${encodeURIComponent(market)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    const data = await res.json();
    if (data.headlines && Array.isArray(data.headlines)) {
      result.newsHeadlines = data.headlines.map((h: { title: string }) => h.title).slice(0, 10);
    }
  } catch (e) {
    // News endpoint may not exist yet (Codex task) — silently skip
  }

  return result;
}

// ============================================================
// User Prompt Builder
// ============================================================

function buildUserPrompt(input: UserStrategyInput, context?: MarketContext): string {
  let prompt = "";

  // Inject market context if available
  if (context?.marketPrompt) {
    prompt += `${context.marketPrompt}\n\n`;
  }

  // Inject news if available
  if (context?.newsHeadlines?.length) {
    prompt += `[RECENT NEWS]\n`;
    for (const headline of context.newsHeadlines) {
      prompt += `- ${headline}\n`;
    }
    prompt += `\n`;
  }

  prompt += `[USER REQUEST]\n`;
  prompt += `Generate a trading strategy based on this request:\n\n`;
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

  prompt += `\nIMPORTANT: Use the market context above to inform your strategy choices — pick tickers and indicators appropriate for the current market regime. Respond with ONLY a JSON object that has EXACTLY these top-level keys: schema_version, name, description, style, risk_level, universe, timeframe, indicators, entry_rules, exit_rules, risk_management, backtest_config. No other text, no markdown.`;
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
   * Generate a strategy from user input (retries once on validation failure).
   * Fetches current market context to inject into the prompt.
   */
  async generate(input: UserStrategyInput): Promise<StrategyDefinition> {
    // Fetch market context (non-blocking — uses defaults if unavailable)
    const market = input.preferences?.market || "US";
    let context: MarketContext | undefined;
    try {
      context = await fetchMarketContext(market);
    } catch (e) {
      console.warn("Market context fetch failed (non-fatal):", (e as Error).message);
    }

    const userPrompt = buildUserPrompt(input, context);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const retryPrompt = attempt === 0
          ? userPrompt
          : `${userPrompt}\n\nIMPORTANT: Your previous attempt failed validation with these errors:\n${lastError!.message}\n\nFix these issues and try again.`;

        const raw = await this.provider.generate(SYSTEM_PROMPT, retryPrompt);
        const strategy = this.parseStrategy(raw);
        this.normalizeEnums(strategy);
        this.repair(strategy);
        this.validate(strategy);

        strategy.ai_metadata = {
          model_used: this.provider.name,
          prompt_hash: this.hashString(userPrompt),
          generation_timestamp: new Date().toISOString(),
          user_input_summary: input.description,
          confidence_notes: strategy.description,
        };

        return strategy;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt === 0) {
          console.warn(`Generation attempt 1 failed, retrying: ${lastError.message.substring(0, 200)}`);
        }
      }
    }

    throw lastError!;
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
   * Normalize enum fields to lowercase_underscore to handle AI capitalisation variance
   */
  private normalizeEnums(strategy: any): void {
    const slug = (s: string) => String(s).toLowerCase().replace(/[\s-]+/g, "_");
    if (strategy.style)      strategy.style      = slug(strategy.style);
    if (strategy.risk_level) strategy.risk_level = slug(strategy.risk_level);
    if (strategy.universe?.market)      strategy.universe.market      = String(strategy.universe.market).toUpperCase();
    if (strategy.universe?.asset_class) strategy.universe.asset_class = slug(strategy.universe.asset_class);
    if (strategy.timeframe)  strategy.timeframe  = String(strategy.timeframe).toLowerCase();
  }

  /**
   * Auto-repair common LLM structural mistakes before validation
   */
  private repair(strategy: any): void {
    // Fix: LLM sometimes uses "type" instead of "logic" in condition groups
    const fixConditionGroups = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      if (obj.type === 'AND' || obj.type === 'OR') {
        obj.logic = obj.type;
        delete obj.type;
      }
      if (obj.rules && !obj.conditions) {
        obj.conditions = obj.rules;
        delete obj.rules;
      }
      if (Array.isArray(obj.conditions)) {
        obj.conditions.forEach((c: any) => fixConditionGroups(c));
      }
    };

    // Fix entry rules
    for (const rule of strategy.entry_rules ?? []) {
      fixConditionGroups(rule.conditions);

      // Fix position_sizing: "type" -> "method"
      if (rule.position_sizing) {
        if (rule.position_sizing.type && !rule.position_sizing.method) {
          rule.position_sizing.method = rule.position_sizing.type;
          delete rule.position_sizing.type;
        }
        // Fix common naming: "percentage_of_capital" -> "percent_of_portfolio"
        if (rule.position_sizing.method === 'percentage_of_capital') {
          rule.position_sizing.method = 'percent_of_portfolio';
        }
        // Ensure percent field exists for percent_of_portfolio
        if (rule.position_sizing.method === 'percent_of_portfolio' && !rule.position_sizing.percent) {
          rule.position_sizing.percent = 10; // safe default
        }
      }

      // Ensure side exists
      if (!rule.side) rule.side = 'long';
    }

    // Fix exit rules: value in params -> top-level
    for (const rule of strategy.exit_rules ?? []) {
      if (!rule.value && rule.params?.value) {
        rule.value = rule.params.value;
        delete rule.params;
      }
      // Ensure priority
      if (!rule.priority) {
        rule.priority = rule.type === 'stop_loss' ? 1 : rule.type === 'take_profit' ? 2 : 3;
      }
    }

    // Fix backtest_config field names
    if (strategy.backtest_config) {
      const bc = strategy.backtest_config;
      if (bc.commission !== undefined && bc.commission_percent === undefined) {
        bc.commission_percent = bc.commission;
        delete bc.commission;
      }
      if (bc.slippage !== undefined && bc.slippage_percent === undefined) {
        bc.slippage_percent = bc.slippage;
        delete bc.slippage;
      }
      if (!bc.currency) {
        bc.currency = strategy.universe?.market === 'IN' ? 'INR' : 'USD';
      }
    }

    // Fix ticker format for Indian market
    if (strategy.universe?.market === 'IN' && strategy.universe?.tickers) {
      strategy.universe.tickers = strategy.universe.tickers.map((t: string) => {
        if (t === '^NSEI' || t === '^NIFTY' || t === 'NIFTY50') return t; // skip indices
        return t.endsWith('.NS') ? t : `${t}.NS`;
      });
    }

    // Ensure schema_version
    if (!strategy.schema_version) strategy.schema_version = '1.0.0';
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
    if (!strategy.universe?.tickers?.length) {
      errors.push("Universe must have a tickers array with at least one ticker");
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

    // ---- Deep validation: indicator types ----
    const SUPPORTED_INDICATORS: string[] = [
      'SMA', 'EMA', 'WMA', 'VWAP', 'RSI', 'MACD', 'STOCH', 'CCI', 'WILLIAMS_R', 'MFI',
      'BBANDS', 'ATR', 'KELTNER', 'DONCHIAN', 'OBV', 'VOLUME_SMA', 'ADX', 'SUPERTREND',
      'ICHIMOKU', 'PSAR', 'SUPPORT', 'RESISTANCE', 'PIVOT_POINTS',
      'PRICE_CHANGE_PCT', 'HIGH_LOW_RANGE', 'GAP',
    ];

    for (const ind of (strategy as any).indicators ?? []) {
      if (!ind.id) errors.push(`Indicator missing id`);
      if (!ind.type) errors.push(`Indicator ${ind.id ?? '?'} missing type`);
      else if (!SUPPORTED_INDICATORS.includes(ind.type.toUpperCase())) {
        errors.push(`Unsupported indicator type: ${ind.type} (supported: ${SUPPORTED_INDICATORS.join(', ')})`);
      }
      // Validate params
      const params = ind.params ?? {};
      if (['SMA', 'EMA', 'WMA', 'RSI', 'ATR', 'ADX', 'CCI', 'WILLIAMS_R', 'MFI'].includes(ind.type?.toUpperCase())) {
        if (params.period !== undefined && (typeof params.period !== 'number' || params.period < 1)) {
          errors.push(`Indicator ${ind.id}: period must be a positive number (got ${params.period})`);
        }
      }
    }

    // ---- Deep validation: entry rule conditions structure ----
    for (const rule of (strategy as any).entry_rules ?? []) {
      if (!rule.conditions?.logic) {
        errors.push(`Entry rule ${rule.id ?? rule.name ?? '?'}: conditions must have a "logic" field ("AND" or "OR")`);
      }
      if (!Array.isArray(rule.conditions?.conditions) || rule.conditions.conditions.length === 0) {
        errors.push(`Entry rule ${rule.id ?? rule.name ?? '?'}: conditions.conditions must be a non-empty array`);
      }
      // Validate each condition has left/operator/right
      for (const c of rule.conditions?.conditions ?? []) {
        if (c.logic) continue; // nested group, skip
        if (!c.left) errors.push(`Condition ${c.id ?? '?'}: missing "left" field`);
        if (!c.operator) errors.push(`Condition ${c.id ?? '?'}: missing "operator" field`);
        if (!c.right && c.right !== 0) errors.push(`Condition ${c.id ?? '?'}: missing "right" field`);
      }
    }

    // ---- Deep validation: exit rule values ----
    for (const rule of (strategy as any).exit_rules ?? []) {
      if (['stop_loss', 'take_profit', 'trailing_stop'].includes(rule.type)) {
        if (typeof rule.value !== 'number' || rule.value <= 0) {
          errors.push(`Exit rule ${rule.id ?? rule.name ?? '?'}: ${rule.type} must have a positive numeric value`);
        }
      }
    }

    // ---- Deep validation: position sizing ----
    for (const rule of (strategy as any).entry_rules ?? []) {
      const ps = rule.position_sizing;
      if (!ps?.method) {
        errors.push(`Entry rule ${rule.id ?? rule.name ?? '?'}: position_sizing.method is required`);
      }
      if (ps?.method === 'percent_of_portfolio' && (typeof ps.percent !== 'number' || ps.percent <= 0 || ps.percent > 100)) {
        errors.push(`Entry rule ${rule.id ?? rule.name ?? '?'}: position_sizing.percent must be between 0 and 100`);
      }
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
// Gemini Adapter (Google AI — free tier: 1500 req/day)
// ============================================================

export class GeminiProvider implements LLMProvider {
  name = "gemini";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "gemini-2.5-flash") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );
    const data = await res.json();
    if (data.error) throw new Error(`Gemini API error: ${data.error.message}`);
    return data.candidates[0].content.parts[0].text;
  }
}

// ============================================================
// OpenRouter Adapter (OpenAI-compatible, many free models)
// ============================================================

export class OpenRouterProvider implements LLMProvider {
  name = "openrouter";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "google/gemma-3-12b-it:free") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        "HTTP-Referer": "https://strategyforge.app",
        "X-Title": "StrategyForge",
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
    if (data.error) throw new Error(`OpenRouter API error: ${data.error.message}`);
    return data.choices[0].message.content;
  }
}

// ============================================================
// Factory — Convenience function
// ============================================================

export function createGenerator(config: {
  provider: "claude" | "openai" | "openrouter" | "gemini";
  apiKey: string;
  model?: string;
}): StrategyGenerator {
  if (config.provider === "claude") {
    return new StrategyGenerator(new ClaudeProvider(config.apiKey, config.model));
  } else if (config.provider === "openrouter") {
    return new StrategyGenerator(new OpenRouterProvider(config.apiKey, config.model));
  } else if (config.provider === "gemini") {
    return new StrategyGenerator(new GeminiProvider(config.apiKey, config.model));
  } else {
    return new StrategyGenerator(new OpenAIProvider(config.apiKey, config.model));
  }
}
