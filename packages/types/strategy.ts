/**
 * StrategyForge — Core Strategy Schema
 * 
 * This is THE foundational type system. Every component depends on it:
 * - AI Engine generates strategies conforming to this schema
 * - Backtesting Engine executes strategies using this schema
 * - Confidence Scorer evaluates live fitness using this schema
 * - Frontend renders strategy details from this schema
 * 
 * Design principles:
 * 1. Serializable to JSON (stored in PostgreSQL JSONB column)
 * 2. Deterministic execution (same schema + same data = same backtest result)
 * 3. Human-readable (users can inspect and understand the logic)
 * 4. Extensible (new indicator types, conditions, etc. without breaking existing strategies)
 */

// ============================================================
// ENUMS
// ============================================================

export type Market = "US" | "IN";

export type AssetClass = "equity" | "index" | "etf";

export type Timeframe = "5m" | "15m" | "1h" | "4h" | "1d" | "1w";

export type StrategyStyle =
  | "momentum"        // trend following, breakout
  | "mean_reversion"  // oversold/overbought plays
  | "swing"           // multi-day holds on technicals
  | "positional"      // weeks-to-months based on fundamentals + technicals
  | "intraday"        // same-day entry and exit
  | "portfolio"       // multi-asset allocation and rebalancing
  | "hybrid";         // combination of styles

export type RiskLevel = "conservative" | "moderate" | "aggressive";

export type PositionSide = "long" | "short" | "both";

// ============================================================
// UNIVERSE — What assets the strategy trades
// ============================================================

export interface UniverseDefinition {
  market: Market;
  asset_class: AssetClass;
  
  /**
   * Explicit ticker list OR dynamic selection criteria
   * Examples:
   *   explicit: ["AAPL", "MSFT", "GOOGL"]
   *   explicit (India): ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS"]
   *   dynamic: use `selection_criteria` instead
   */
  tickers?: string[];
  
  /**
   * Dynamic universe selection (e.g., "top 20 NIFTY50 by RSI")
   * If provided, tickers are resolved at backtest time
   */
  selection_criteria?: {
    index_membership?: string;           // "NIFTY50", "SP500", "NIFTY_BANK"
    min_market_cap_usd?: number;         // e.g., 1_000_000_000
    sector_filter?: string[];            // ["Technology", "Finance"]
    min_avg_volume?: number;             // minimum average daily volume
    max_universe_size?: number;          // cap on number of stocks
    sort_by?: string;                    // metric to sort by
    sort_order?: "asc" | "desc";
  };
}

// ============================================================
// INDICATORS — Technical analysis building blocks
// ============================================================

export type IndicatorType =
  // Moving Averages
  | "SMA" | "EMA" | "WMA" | "VWAP"
  // Oscillators
  | "RSI" | "MACD" | "STOCH" | "CCI" | "WILLIAMS_R" | "MFI"
  // Volatility
  | "BBANDS" | "ATR" | "KELTNER" | "DONCHIAN"
  // Volume
  | "OBV" | "VOLUME_SMA" | "VWAP"
  // Trend
  | "ADX" | "SUPERTREND" | "ICHIMOKU" | "PSAR"
  // Price Action
  | "SUPPORT" | "RESISTANCE" | "PIVOT_POINTS"
  // Custom/Derived
  | "PRICE_CHANGE_PCT" | "HIGH_LOW_RANGE" | "GAP";

export interface IndicatorConfig {
  id: string;              // unique reference, e.g., "rsi_14", "ema_50"
  type: IndicatorType;
  params: Record<string, number | string>;  // e.g., { period: 14 } or { fast: 12, slow: 26, signal: 9 }
  apply_to?: "close" | "open" | "high" | "low" | "volume";  // default: "close"
}

// ============================================================
// CONDITIONS — The logic that drives entries, exits, filters
// ============================================================

export type ComparisonOperator =
  | "gt"       // greater than
  | "gte"      // greater than or equal
  | "lt"       // less than
  | "lte"      // less than or equal
  | "eq"       // equal (with tolerance for floats)
  | "crosses_above"   // value crosses above threshold (previous bar was below)
  | "crosses_below"   // value crosses below threshold
  | "between";        // value is between two thresholds

export type ConditionValueSource =
  | { type: "indicator"; indicator_id: string; field?: string }  // reference an indicator, optional field (e.g., "upper" for BBANDS)
  | { type: "price"; field: "open" | "close" | "high" | "low" }
  | { type: "constant"; value: number }
  | { type: "indicator_prev"; indicator_id: string; bars_ago: number; field?: string };  // lagged indicator value

export interface Condition {
  id: string;
  left: ConditionValueSource;
  operator: ComparisonOperator;
  right: ConditionValueSource;
  description?: string;  // human-readable: "RSI(14) crosses below 30"
}

export interface ConditionGroup {
  logic: "AND" | "OR";
  conditions: (Condition | ConditionGroup)[];  // nested groups for complex logic
}

// ============================================================
// ENTRY & EXIT RULES
// ============================================================

export interface EntryRule {
  id: string;
  name: string;
  side: PositionSide;
  conditions: ConditionGroup;
  
  /**
   * Position sizing for this entry
   */
  position_sizing: PositionSizing;
  
  /**
   * Optional: limit entries to specific times/days
   */
  time_filter?: {
    allowed_days?: number[];          // 0=Mon, 4=Fri
    entry_after?: string;             // "09:30" (market time)
    entry_before?: string;            // "15:00"
    no_entry_before_close_minutes?: number;  // don't enter within N minutes of close
  };
  
  /**
   * Cool-down: minimum bars between entries for same ticker
   */
  cooldown_bars?: number;
}

export interface ExitRule {
  id: string;
  name: string;
  type: "stop_loss" | "take_profit" | "trailing_stop" | "time_based" | "indicator_based" | "break_even";
  
  /**
   * For stop_loss / take_profit: percentage from entry
   * For trailing_stop: trail percentage
   * For time_based: max holding bars
   */
  value?: number;
  
  /**
   * For indicator_based exits
   */
  conditions?: ConditionGroup;
  
  /**
   * Priority: lower number = checked first
   * Stop loss should always be priority 1
   */
  priority: number;
}

// ============================================================
// POSITION SIZING
// ============================================================

export type PositionSizing =
  | { method: "fixed_amount"; amount: number }                        // e.g., $1000 per trade
  | { method: "percent_of_portfolio"; percent: number }               // e.g., 5% of portfolio per position
  | { method: "percent_risk"; risk_percent: number; atr_multiplier?: number }  // risk X% of portfolio, size based on stop distance
  | { method: "equal_weight"; max_positions: number }                 // divide equally across N positions
  | { method: "volatility_adjusted"; target_volatility: number };     // adjust size to target vol

// ============================================================
// REBALANCING — Portfolio-level strategy management
// ============================================================

export interface RebalancingConfig {
  enabled: boolean;
  
  /**
   * When to trigger rebalancing
   */
  trigger:
    | { type: "calendar"; frequency: "daily" | "weekly" | "monthly" | "quarterly" }
    | { type: "drift"; max_drift_percent: number }   // rebalance when any position drifts X% from target
    | { type: "signal"; conditions: ConditionGroup }; // rebalance on indicator conditions
  
  /**
   * How to rebalance
   */
  method:
    | { type: "target_weights"; weights: Record<string, number> }   // explicit weights: { "AAPL": 0.2, "MSFT": 0.15 }
    | { type: "equal_weight" }
    | { type: "risk_parity" }                                       // weight inversely to volatility
    | { type: "momentum_rank"; lookback_bars: number; top_n: number }; // overweight top momentum stocks
  
  /**
   * Constraints during rebalancing
   */
  constraints?: {
    min_weight?: number;           // minimum 2% per position
    max_weight?: number;           // maximum 25% per position
    max_turnover_percent?: number; // don't trade more than X% of portfolio in one rebalance
    min_trade_size_usd?: number;   // don't place tiny trades
  };
}

// ============================================================
// RISK MANAGEMENT — Portfolio-level guardrails
// ============================================================

export interface RiskManagement {
  max_portfolio_drawdown_percent?: number;    // stop all trading if portfolio drops X% from peak
  max_position_count?: number;                // e.g., max 10 open positions
  max_single_position_percent?: number;       // no single position > X% of portfolio
  max_sector_exposure_percent?: number;       // no single sector > X%
  max_correlated_positions?: number;          // limit highly correlated holdings
  daily_loss_limit_percent?: number;          // stop trading for the day if loss exceeds X%
  use_margin?: boolean;                       // default false
  max_leverage?: number;                      // if margin enabled, max leverage ratio
}

// ============================================================
// STRATEGY — The complete strategy definition
// ============================================================

export interface StrategyDefinition {
  /**
   * Metadata
   */
  schema_version: "1.0.0";
  id?: string;                     // assigned by platform after creation
  name: string;                    // "Golden Cross Momentum - NIFTY50"
  description: string;             // AI-generated human-readable explanation
  style: StrategyStyle;
  risk_level: RiskLevel;
  
  /**
   * Market & Asset Configuration
   */
  universe: UniverseDefinition;
  timeframe: Timeframe;
  
  /**
   * Indicators used by this strategy
   */
  indicators: IndicatorConfig[];
  
  /**
   * Entry rules (at least one required)
   */
  entry_rules: EntryRule[];
  
  /**
   * Exit rules (stop_loss is mandatory)
   */
  exit_rules: ExitRule[];
  
  /**
   * Portfolio rebalancing (for portfolio strategies)
   */
  rebalancing?: RebalancingConfig;
  
  /**
   * Risk guardrails
   */
  risk_management: RiskManagement;
  
  /**
   * Backtest configuration
   */
  backtest_config: {
    initial_capital: number;         // e.g., 100000
    currency: "USD" | "INR";
    commission_percent: number;      // e.g., 0.1 for 0.1%
    slippage_percent: number;        // e.g., 0.05 for 0.05%
    start_date?: string;             // ISO date, default: max available
    end_date?: string;               // ISO date, default: today
  };
  
  /**
   * AI generation metadata (set by the system, not user)
   */
  ai_metadata?: {
    model_used: string;              // "claude-sonnet-4-20250514" or "gpt-4o"
    prompt_hash: string;             // hash of the prompt that generated this
    generation_timestamp: string;    // ISO datetime
    user_input_summary: string;      // what the user asked for
    confidence_notes: string;        // AI's notes on why it chose this approach
    dynamic_universe?: boolean;      // true if universe.tickers were injected from live screener
    universe_source?: string;        // "live_screener" | "ai_generated"
  };
}

// ============================================================
// BACKTEST RESULTS — Output of the backtesting engine
// ============================================================

export interface TradeRecord {
  ticker: string;
  side: "long" | "short";
  entry_date: string;
  entry_price: number;
  exit_date: string;
  exit_price: number;
  exit_reason: string;           // "stop_loss", "take_profit", "indicator_exit", etc.
  position_size: number;
  pnl: number;
  pnl_percent: number;
  holding_bars: number;
  commission_paid: number;
}

export interface MonthlyReturn {
  year: number;
  month: number;
  return_percent: number;
  trades: number;
  win_rate: number;
}

export interface RegimePerformance {
  regime: "bull" | "bear" | "sideways";
  period: string;                // "2022-01 to 2022-06"
  return_percent: number;
  sharpe: number;
  max_drawdown: number;
  trade_count: number;
}

export interface StrategyScore {
  overall: number;               // 0-100 composite
  breakdown: {
    sharpe_ratio: { value: number; score: number; weight: 0.25 };
    max_drawdown: { value: number; score: number; weight: 0.20 };
    win_rate: { value: number; score: number; weight: 0.10 };
    profit_factor: { value: number; score: number; weight: 0.15 };
    consistency: { value: number; score: number; weight: 0.15 };
    regime_score: { value: number; score: number; weight: 0.15 };
  };
  grade: "S" | "A" | "B" | "C" | "D" | "F";  // S=90+, A=80+, B=70+, C=60+, D=40+, F=<40
  publishable: boolean;          // score >= 40
  verified: boolean;             // score >= 70
}

export interface BacktestResult {
  strategy_id: string;
  run_id: string;
  run_timestamp: string;
  
  /**
   * Summary metrics
   */
  summary: {
    total_return_percent: number;
    annualized_return_percent: number;
    sharpe_ratio: number;
    sortino_ratio: number;
    max_drawdown_percent: number;
    max_drawdown_duration_days: number;
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number;
    profit_factor: number;
    avg_win_percent: number;
    avg_loss_percent: number;
    avg_holding_bars: number;
    best_trade_percent: number;
    worst_trade_percent: number;
    calmar_ratio: number;
    volatility_annual: number;
    benchmark_return_percent: number;  // buy & hold of the primary asset/index
    alpha: number;                     // excess return over benchmark
    beta: number;                      // correlation to benchmark
  };
  
  /**
   * Scoring
   */
  score: StrategyScore;
  
  /**
   * Equity curve: array of [timestamp, portfolio_value]
   */
  equity_curve: [string, number][];
  
  /**
   * Drawdown curve: array of [timestamp, drawdown_percent]
   */
  drawdown_curve: [string, number][];
  
  /**
   * All trades
   */
  trades: TradeRecord[];
  
  /**
   * Monthly returns grid
   */
  monthly_returns: MonthlyReturn[];
  
  /**
   * Performance by market regime
   */
  regime_performance: RegimePerformance[];
  
  /**
   * Walk-forward validation result (out-of-sample performance)
   */
  walk_forward?: {
    in_sample_score: number;
    out_of_sample_score: number;
    degradation_percent: number;   // how much worse OOS vs IS
    overfitting_risk: "low" | "medium" | "high";
  };
}

// ============================================================
// CONFIDENCE SCORE — Live, dynamic assessment
// ============================================================

export interface ConfidenceScore {
  strategy_id: string;
  timestamp: string;
  
  overall: number;              // 0-100
  
  components: {
    backtest_strength: {        // 40% weight
      score: number;
      weight: number;
      description: string;     // "Strong historical performance (Sharpe 1.8)"
    };
    regime_fit: {               // 30% weight
      score: number;
      weight: number;
      current_regime: "bull" | "bear" | "sideways" | "unknown";
      preferred_regime?: string;              // Python returns this instead of strategy_regime_preference
      strategy_regime_preference?: string;    // kept for backwards compatibility
      description: string;     // "Current trending market reduces confidence for this mean-reversion strategy"
    };
    signal_proximity: {         // 20% weight
      score: number;
      weight: number;
      nearest_signal: string;  // "Entry signal 3% away (RSI at 35, trigger at 30)"
      triggered?: boolean;
      description: string;
    };
    volatility_context: {       // 10% weight
      score: number;
      weight: number;
      current_vix?: number;
      india_vix?: number | null;
      us_vix?: number | null;
      realized_vol?: number;
      level?: string;
      strategy_vol_range?: [number, number];  // [min, max] tested range
      description: string;     // "Current volatility within strategy's tested range"
    };
  };

  /**
   * Recommendation label returned by Python engine
   */
  recommendation_label?: string;  // "Favorable" | "Neutral" | "Cautious" | "Unfavorable"

  /**
   * Global risk indicators from Python engine
   */
  global_risk?: {
    sp500_5d_return?: number;
    sp500_trend?: string;
    crude_5d_return?: number;
    crude_trend?: string;
    usdinr_5d_change?: number;
    inr_pressure?: string;
  };

  /**
   * Actionable recommendation
   */
  recommendation: "strong_buy" | "buy" | "hold" | "reduce" | "exit";
  reasoning: string;            // AI-generated explanation of the score
  
  /**
   * Rebalancing suggestion (if applicable)
   */
  rebalancing_suggestion?: RebalancingSuggestion;
}

export interface RebalancingSuggestion {
  urgency: "low" | "medium" | "high";
  reason: string;               // "Portfolio drift exceeds 5% threshold"
  
  actions: {
    ticker: string;
    action: "buy" | "sell" | "hold";
    current_weight_percent: number;
    target_weight_percent: number;
    suggested_quantity?: number;
    reasoning: string;
  }[];
  
  estimated_turnover_percent: number;
  estimated_commission: number;
}

// ============================================================
// USER INPUT — What the user provides to generate a strategy
// ============================================================

export interface UserStrategyInput {
  /**
   * Natural language description of what they want
   * "I want a momentum strategy for top NIFTY50 stocks, moderate risk, holding 1-2 weeks"
   */
  description: string;
  
  /**
   * Structured preferences (optional, AI fills gaps)
   */
  preferences?: {
    market?: Market;
    risk_level?: RiskLevel;
    style?: StrategyStyle;
    timeframe?: Timeframe;
    capital?: number;
    currency?: "USD" | "INR";
    max_positions?: number;
    preferred_indicators?: string[];
    avoid_sectors?: string[];
    holding_period?: string;       // "intraday", "1-5 days", "1-4 weeks", "1-6 months"
    commission_percent?: number;   // e.g., 0.1 for US, 0.03 for IN
    slippage_percent?: number;     // e.g., 0.05 for US, 0.1 for IN
  };
}
