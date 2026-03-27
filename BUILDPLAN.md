# StrategyForge v2 — Master Build Plan

> Last updated: 2026-03-27
> Status: Planning phase — pre-build

---

## Table of Contents

1. [Product Vision](#product-vision)
2. [Current State (Honest Assessment)](#current-state)
3. [Competitive Landscape](#competitive-landscape)
4. [Open Source Reference Projects](#open-source-reference-projects)
5. [Build Plan — 4 Phases](#build-plan)
   - [Phase 1: Fix the Foundation](#phase-1-fix-the-foundation)
   - [Phase 2: Market Intelligence Layer](#phase-2-market-intelligence-layer)
   - [Phase 3: Simple Mode + Conversational UI](#phase-3-simple-mode--conversational-ui)
   - [Phase 4: Polish + Scale](#phase-4-polish--scale)
6. [Data & AI Strategy](#data--ai-strategy)
7. [Research Homework](#research-homework)
8. [Execution Timeline](#execution-timeline)

---

## Product Vision

StrategyForge fills the gap between Composer (no-code, shallow analysis) and QuantConnect (deep analysis, requires coding). Two modes, one engine:

**Expert Mode** (current): Describe strategy in trading terms → AI generates structured strategy → backtest → full metrics.

**Simple Mode** (new): Conversational entry for general public. "What's on your mind about your money?" → AI understands intent → generates strategy → backtest → explains results in plain English.

**Core loop:** Describe idea → AI generates strategy → Backtest with honest scoring → Live confidence → Iterate.

**Market toggle:** US / India / Crypto (later). Top-level selector that changes asset universe, market snapshot, default tickers, and currency display.

**Key differentiators:**
- Dual-market (US + India) — no competitor does both
- Radical honesty — methodology disclosure, <30 trade warnings, benchmark comparison
- No trade execution — advice/backtest only (lower regulatory burden, no custody risk)
- AI-powered with market context awareness

---

## Current State

### What Works
- AI generation (Claude, Gemini, OpenAI, OpenRouter) → StrategyDefinition JSON
- Event-driven backtest loop with commission/slippage
- 23 technical indicators (20 fully implemented, 3 stubs)
- Composite 0-100 strategy score with grade assignment
- Walk-forward validation (70/30 IS/OOS split)
- Confidence scorer (regime + signal proximity + vol context)
- Streaming backtest with SSE progress events
- Next.js frontend with equity curve, drawdown, trade table, monthly returns
- Prisma ORM with PostgreSQL (Neon cloud)

### What's Broken
| Category | Issue | Impact |
|----------|-------|--------|
| **Data Source** | yfinance unreliable — templates fail because tickers return empty data | Core product broken |
| **Data Source** | Intraday limited to 60 days | Can't backtest 5m/15m strategies properly |
| **Data Source** | Indian .NS tickers often return sparse data | India market unreliable |
| **Cache** | Daily data expires after 1 hour | Stale OHLC mid-session |
| **Backtester** | Only first ticker used from universe | No portfolio/multi-asset strategies |
| **Backtester** | 3 of 5 position sizing methods not implemented | percent_risk, equal_weight, volatility_adjusted missing |
| **Backtester** | Risk management not enforced | max_drawdown and max_position_count ignored |
| **Indicators** | GAP, SUPPORT, RESISTANCE are stubs | Strategies using these fail silently |
| **Confidence** | Regime detection simplistic (ADX only) | Misses real market transitions |
| **Confidence** | Vol context uses static thresholds | Doesn't match backtest vol profile |
| **Confidence** | Global risk signals computed but not scored | Doesn't affect confidence output |
| **AI Generator** | No market context in prompt | Generates strategies in a vacuum |
| **AI Generator** | No feedback loop | Can't improve a bad strategy iteratively |
| **Frontend** | No preflight feedback shown | User doesn't see timeframe fallbacks |
| **Frontend** | No Simple Mode | Only serves experts |

---

## Competitive Landscape

### Direct Competitors

| Product | Audience | Markets | AI? | Execution? | Strength | Weakness |
|---|---|---|---|---|---|---|
| **Composer** ($30/mo) | Beginner-Intermediate | US only | Yes | Yes (Alpaca) | Best visual strategy builder | US-only; withdrawal complaints |
| **QuantConnect** ($20-80/mo) | Expert (quants) | US, crypto, forex | No | Yes | Deepest data (400TB+); most rigorous engine | Requires coding; no India |
| **Streak.tech** (Free-₹1400/mo) | Beginner-Intermediate | India only | No | Semi-auto | Zerodha integration; beginner-friendly | No AI; no multi-timeframe; Zerodha locked |
| **Smallcase** | Beginner (passive) | India only | No | Yes (16+ brokers) | Simplest investing experience | Zero customization; no backtesting |
| **Tickertape** | Beginner-Intermediate | India + US | No | No (research only) | Market Mood Index; 200+ filters | No strategy building; no backtesting |
| **TradingView** ($0-56/mo) | Intermediate-Expert | Global | Partial | Yes (broker links) | Largest community; best charting | Requires Pine Script; no AI generation |
| **Magnifi** ($14/mo) | Beginner | US only | Yes | Yes | Best conversational zero-jargon AI | No backtesting; no strategy building |
| **Wealthfront** (0.25% AUM) | Beginner (passive) | US only | No | Yes (fully auto) | Best tax-loss harvesting | Zero customization; black-box |

### Emerging AI Threats (2025-2026)
| Tool | Notable Feature |
|---|---|
| **TrendSpider Sidekick AI** | Natural language → strategy + no-code AI model training |
| **LuxAlgo AI** | Generates backtest code from plain English |
| **Trade Ideas (Holly AI)** | AI backtests all US stocks daily, presents statistical picks |
| **Danelfin** | AI scores stocks for dividend, growth, low-risk strategies |

### Key Competitive Insights

1. **Nobody combines ALL of:** AI generation + honest backtesting + US+India + advice-only
2. **"No execution" is a feature** — Composer's #1 complaint is fund withdrawal issues
3. **Honesty is an unoccupied moat** — every competitor's users complain about rosy backtests
4. **Dual-market is unique** — Composer/Magnifi = US only, Streak/Smallcase = India only
5. **Pricing sweet spot: $15-25/mo** (below Composer with execution, above Magnifi without backtesting)

### What to Steal From Each
| From | Steal This |
|---|---|
| **Composer** | Visual strategy flowchart — users love seeing strategy as diagram |
| **Smallcase** | Theme-based entry points named after trends people recognize |
| **Magnifi** | Conversational zero-jargon tone |
| **Tickertape** | 0-100 scoring visual presentation (gauges, color grades) |
| **TradingView** | Community strategy marketplace (future) |
| **Wealthfront** | Risk questionnaire that doesn't feel like a questionnaire |
| **QuantConnect** | Rigorous methodology — market it harder |

---

## Open Source Reference Projects

### Tier 1 — Study These Closely

| Project | Stars | What It Does | What We Learn |
|---|---|---|---|
| **TradingAgents** (TauricResearch) | ~42k | Multi-agent LLM framework (analyst, trader, risk manager agents) | Decompose strategy generation into specialized sub-agents |
| **ZipLime** (Limex-com) | New | Modernized Zipline with plain-English AI strategy generation | Their NL→strategy→backtest pipeline — closest reference |
| **FinGPT** (AI4Finance) | ~19k | Open-source financial LLM for sentiment analysis | Pre-trained sentiment models for confidence scorer |
| **Vibe Trade** (vibetrade-ai) | New | Claude-powered plain-English strategy agent | Their "Playbook" concept for structured strategy from NL |
| **Screeni-py** (pranjal-joshi) | ~668 | Python stock screener for NSE India | NSE data handling and breakout detection for India |

### Tier 2 — Architecture Patterns

| Project | Stars | What We Steal |
|---|---|---|
| **Backtrader** (mementum) | ~20k | Gold-standard event-driven architecture, commission/slippage models |
| **Backtesting.py** (kernc) | ~8.1k | Clean Strategy class + interactive Bokeh equity curve visualizations |
| **fastquant** (enzoampil) | ~1.7k | Extreme API simplification — `backtest('smac', data)` preset pattern |
| **FinRobot** (AI4Finance) | ~6.2k | RAG + vector DB pipeline for financial Q&A |
| **Jesse** (jesse-ai) | ~6.6k | JesseGPT integration + Optuna parameter optimization |
| **OpenAlice** (TraderAlice) | New | "Trading-as-Git" paradigm with guard pipeline for risk management |

### Tier 3 — Data & Sentiment

| Project | Stars | What We Learn |
|---|---|---|
| **FinRL** (AI4Finance) | ~14k | Market environment abstraction (OHLCV + indicators as observation space) |
| **stocksight** (shirosaidev) | ~2k | Dual-source sentiment pipeline (Twitter + news) with Elasticsearch |
| **LangChain Stock Screener** | Small | NL queries → technical indicator filters via tool-use pattern |
| **ML for Trading** (stefan-jansen) | ~16k | Ch10: NLP-for-trading sentiment. Ch4: alpha factor evaluation |

### Tier 4 — Curated Resource Lists

| List | Stars | Use For |
|---|---|---|
| **awesome-quant** (wilsonfreitas) | ~24.8k | Master reference for indicator libraries, data sources, risk tools |
| **awesome-ai-in-finance** (georgezouq) | ~4.5k | Emerging AI-finance papers and LLM trading approaches |
| **awesome-systematic-trading** (wangzhe3224) | ~3k | Data vendors, execution frameworks, risk management libraries |

---

## Build Plan

### Phase 1: Fix the Foundation

*Goal: Every backtest request returns reliable, accurate results. No more empty data failures.*

#### 1.1 — Multi-Source Data Fetcher

**Problem:** yfinance is unreliable, rate-limited, 60-day intraday limit, Indian tickers often fail.

**Solution: Fallback chain with data quality validation.**

```
Primary:   yfinance (free, broad coverage)
Fallback:  Twelve Data API (free tier: 800 req/day, reliable)
Fallback:  Alpha Vantage (free tier: 25 req/day, good for daily)
India:     jugaad-data / nsepython (free, NSE direct, no API key)
Crypto:    CCXT library (unified API for 100+ exchanges, free)
```

**Architecture:**
```python
class DataFetcher:
    sources = [YFinanceSource(), TwelveDataSource(), AlphaVantageSource()]

    def fetch(self, ticker, timeframe, ...):
        for source in self.sources:
            try:
                data = source.fetch(ticker, timeframe)
                if self.validate(data):  # OHLC sanity, min bars, no gaps
                    return data
            except:
                continue
        raise DataUnavailableError(...)
```

**Data quality validation before caching:**
- OHLC sanity: High >= max(Open, Close), Low <= min(Open, Close)
- Volume > 0 for equity tickers
- No duplicate timestamps
- No gaps > 3 business days
- Minimum bar count for requested timeframe

#### 1.2 — Fix Cache System

**Problem:** Daily data expires after 1 hour. Intraday data mixed with daily.

**Fix:**
```python
CACHE_TTL = {
    "5m": 300,      # 5 minutes
    "15m": 900,     # 15 minutes
    "1h": 3600,     # 1 hour
    "4h": 3600,     # 1 hour
    "1d": 86400,    # 24 hours (until next market open)
    "1w": 604800,   # 1 week
}
```

Plus: session-aware cache invalidation — check if latest bar timestamp matches expected (market closed = cache valid longer).

#### 1.3 — Asset Universe & Ticker Mapping

**Problem:** User says "gold" or "small caps" and the system doesn't know what tickers to use.

**Build a mapping table (database table or JSON config):**

```python
ASSET_UNIVERSE = {
    # Commodities
    "gold":       {"US": ["GLD", "IAU"], "IN": ["GOLDBEES.NS"]},
    "silver":     {"US": ["SLV"], "IN": ["SILVERBEES.NS"]},
    "crude_oil":  {"US": ["USO"], "IN": ["CRUDEOIL.NS"]},

    # Sectors
    "banking":    {"US": ["XLF", "KBE"], "IN": ["SBIN.NS", "HDFCBANK.NS", "ICICIBANK.NS", "KOTAKBANK.NS"]},
    "technology": {"US": ["XLK", "QQQ"], "IN": ["TCS.NS", "INFY.NS", "WIPRO.NS", "HCLTECH.NS"]},
    "pharma":     {"US": ["XLV", "IBB"], "IN": ["SUNPHARMA.NS", "DRREDDY.NS", "CIPLA.NS"]},
    "energy":     {"US": ["XLE"], "IN": ["RELIANCE.NS", "ONGC.NS", "NTPC.NS"]},
    "auto":       {"US": ["CARZ"], "IN": ["TATAMOTORS.NS", "M&M.NS", "MARUTI.NS"]},
    "realty":     {"US": ["XLRE", "VNQ"], "IN": ["DLF.NS", "GODREJPROP.NS"]},
    "fmcg":       {"US": ["XLP"], "IN": ["HINDUNILVR.NS", "ITC.NS", "NESTLEIND.NS"]},

    # Market cap
    "large_cap":  {"US": ["SPY", "QQQ", "DIA"], "IN": ["NIFTYBEES.NS"]},
    "mid_cap":    {"US": ["MDY", "IJH"], "IN": ["JUNIORBEES.NS"]},
    "small_cap":  {"US": ["IWM", "IJR"], "IN": ["SMALLCAP50.NS"]},

    # Themes
    "ai_stocks":  {"US": ["NVDA", "MSFT", "GOOGL", "META", "AMD"]},
    "ev_stocks":  {"US": ["TSLA", "RIVN", "NIO"], "IN": ["TATAMOTORS.NS", "M&M.NS"]},
    "dividend":   {"US": ["VYM", "SCHD", "DVY"], "IN": ["ITC.NS", "COALINDIA.NS", "POWERGRID.NS"]},
    "defense":    {"US": ["LMT", "RTX", "NOC"], "IN": ["HAL.NS", "BEL.NS", "BHARATFORGE.NS"]},

    # Indices / Benchmarks
    "nifty":      {"IN": ["^NSEI"]},
    "sensex":     {"IN": ["^BSESN"]},
    "sp500":      {"US": ["^GSPC"]},
    "nasdaq":     {"US": ["^IXIC"]},
}
```

Updated quarterly. AI uses this to resolve user intent → actual tickers.

#### 1.4 — Fix Backtester Gaps

**Priority fixes:**
1. Implement `percent_risk` position sizing (use ATR for stop distance)
2. Implement `volatility_adjusted` position sizing (target vol)
3. Enforce `max_portfolio_drawdown_percent` — halt trading when breached
4. Enforce `max_position_count` — block new entries when at limit
5. Support multi-ticker iteration (entry rules evaluated across all universe tickers)
6. Implement indicator-based exits (type already defined, backtester ignores it)

---

### Phase 2: Market Intelligence Layer

*Goal: The AI knows what's happening in markets RIGHT NOW before generating any strategy.*

#### 2.1 — Market Snapshot Service

**A daily-refresh service that computes current market state.**

```python
class MarketSnapshot:
    def compute(self, market: str) -> dict:
        return {
            "timestamp": "2026-03-27T09:30:00",
            "market": "US",
            "indices": {
                "SPY": {"price": 542.3, "change_1w": 2.1, "change_1m": -1.3,
                         "trend": "bullish", "above_200sma": True},
            },
            "fear_greed": {"vix": 18.5, "level": "moderate", "percentile_1y": 45},
            "sectors": {
                "technology": {"change_1m": 5.2, "rank": 1},
                "energy": {"change_1m": 3.1, "rank": 2},
                "real_estate": {"change_1m": -2.8, "rank": 11},
            },
            "regime": "bullish_trending",
            "macro": {
                "fed_rate": 4.25,
                "fed_outlook": "hold, market expects cut Q3",
                "inflation_cpi": 3.1,
            },
            "hot_tickers": ["NVDA", "TSLA", "AAPL"],
        }
```

**Data sources:** yfinance for indices/sectors/VIX, static config for macro (updated monthly).

**Cache:** Refresh daily after market close. Store in database.

#### 2.2 — News Context (Lightweight)

**Don't build NLP. Feed headlines to the AI — the AI IS the NLP engine.**

```python
class NewsContext:
    def fetch_headlines(self, market: str, limit: int = 10) -> list[str]:
        # NewsAPI.org or Google News RSS (free tier)
        return [
            "Fed signals possible rate cut in September",
            "China tariffs on US goods increased to 25%",
            "NVDA reports record quarterly revenue",
        ]
```

**Sources:**
- NewsAPI.org (free: 100 req/day)
- GNews API (free: 100 req/day)
- Google News RSS (free, no limit)

#### 2.3 — Enhanced AI Prompt

**Strategy generator prompt now includes market context:**

```
[MARKET CONTEXT - 2026-03-27]
S&P 500: 5,420 (+2.1% this month, above 200-SMA, BULLISH)
Nifty 50: 22,850 (-1.3% this month, near 200-SMA, SIDEWAYS)
VIX: 18.5 (moderate fear)
Hot sectors: Technology +5.2%, Energy +3.1%
Cold sectors: Real Estate -2.8%, Utilities -1.9%
Fed rate: 4.25% (holding, market expects cut Q3)

[RECENT NEWS]
- Fed signals possible rate cut in September
- China tariffs on US goods increased to 25%
- Gold hits all-time high amid global uncertainty

[ASSET UNIVERSE]
{relevant tickers for mentioned assets/sectors}

[USER PROFILE - if known]
Risk tolerance: low | Capital: ₹5,00,000 | Horizon: medium

[USER REQUEST]
{their actual prompt}
```

This is the single biggest improvement. The AI stops generating in a vacuum.

---

### Phase 3: Simple Mode + Conversational UI

*Goal: Someone who knows nothing about trading can use StrategyForge.*

#### 3.1 — Intent Parser (New AI Prompt)

**Separate, fast AI call to extract structured intent from free text.**

```
User: "I have 5 lakhs and I'm worried about recession"

→ AI extracts:
{
  "capital": 500000,
  "currency": "INR",
  "market": "IN",
  "risk_tolerance": "low",
  "goal": "capital_preservation",
  "concerns": ["recession", "downside_protection"],
  "time_horizon": "medium",
  "needs_followup": false,
  "suggested_approach": "template:recession_shield"
}
```

**When more info needed:**
```json
{
  "needs_followup": true,
  "followup_questions": [
    "How long can you leave this money invested — 1-2 years or 5+ years?",
    "Do you already have investments, or is this your first time?"
  ]
}
```

**Model:** Gemini Flash or Haiku (structured extraction task, doesn't need heavy reasoning).

**Detection of expert users:** If someone types "RSI(14) < 30 AND EMA50 > EMA200", detect complexity and offer: "Looks like you know your way around. Switch to Expert Mode?"

#### 3.2 — Strategy Templates (Pre-Built)

**8-10 pre-validated StrategyDefinition JSONs:**

| Template | Tickers | Style | Key Indicators | Risk |
|---|---|---|---|---|
| Recession Shield | Low-vol ETFs (USMV/LOWVOL) | Defensive | EMA200 + VIX regime | Low |
| Balanced Compounder | Nifty50/SPY components | Balanced | EMA50/200 + RSI | Moderate |
| Momentum Rider | Top momentum stocks | Momentum | RSI + MACD + ADX | High |
| Dividend Harvester | High-yield stocks | Income | Dividend yield + RSI | Low |
| Sector Conviction | Sector ETF + top holdings | Concentrated | EMA + volume | Moderate |
| Dip Buyer | Large-cap quality | Mean reversion | RSI oversold + BBANDS | Moderate |
| All-Weather | Multi-asset ETFs | Portfolio | Trend + correlation | Low |
| Gold Safe Haven | GLD/GOLDBEES | Commodity | Trend + VIX correlation | Low |

Each template pre-backtested monthly. AI can customize tickers, thresholds, and position sizing based on user's capital and market preference.

#### 3.3 — Result Translator (AI Layer)

**Separate AI call: metrics → plain English.**

Input:
```json
{
  "user_intent": "protect money from recession",
  "summary": {"total_return_percent": 12.3, "max_drawdown_percent": -8.5,
              "sharpe_ratio": 1.4, "win_rate": 62, "total_trades": 47},
  "benchmark_return": 15.1,
  "capital": 500000,
  "currency": "INR"
}
```

Output:
```json
{
  "headline": "Your ₹5L would have grown to ₹5.62L over 5 years",
  "paragraph": "This defensive strategy protected your capital well — during the worst market drop, your ₹5L would have temporarily dipped to ₹4.58L before recovering within 3 months...",
  "confidence_plain": "Moderate confidence — this type of strategy has worked in 3 out of 4 past periods similar to today's market",
  "warnings": [
    "Past performance is not a guarantee of future results",
    "This backtest used 47 trades — enough for basic confidence but not rock-solid"
  ],
  "show_equity_curve": true,
  "show_drawdown_chart": true,
  "show_trade_table": false
}
```

The `show_*` fields tell the frontend which charts add value for this specific user/result.

#### 3.4 — Conversational UI

**Two-tab layout with market toggle:**

```
┌─────────────────────────────────────────────┐
│  [Simple Mode]  [Expert Mode]    [US ▼]     │
├─────────────────────────────────────────────┤
│                                             │
│  What's on your mind about your money?      │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ I have 5 lakhs and markets feel     │    │
│  │ scary right now...                  │    │
│  └─────────────────────────────────────┘    │
│                                    [Ask →]  │
│                                             │
│  ── OR pick a starting point ──             │
│                                             │
│  [Recession Shield] [Steady Growth]         │
│  [Momentum Rider]   [Dividend Income]       │
│  [Dip Buyer]        [Gold Safe Haven]       │
│                                             │
├─────────────────────────────────────────────┤
│  Market Pulse                               │
│  Nifty 50: 22,850 (Sideways)               │
│  India VIX: 14.2 (Low fear)                │
│  Hot: IT +4.1%, Pharma +3.3%               │
│  Cold: Metals -3.2%                        │
└─────────────────────────────────────────────┘
```

**Expert Mode:** Current form (strategy description, provider selection, full metrics).

**Market toggle:** US / India / Crypto. Changes asset universe, snapshot, default tickers, currency.

---

### Phase 4: Polish + Scale

#### 4.1 — Scoring Improvements
- Feed walk-forward results back into score (penalize overfit strategies)
- Add Sortino, Calmar to score components
- Parameter sensitivity analysis (overfitting detector)

#### 4.2 — Interactive Charts
- Replace static Recharts with interactive Bokeh-style equity curves (reference: Backtesting.py)
- Click on trade in chart → see entry/exit details
- Hover on drawdown → see duration and recovery time

#### 4.3 — Strategy Marketplace
- Users publish strategies (minimum score 40)
- Browse by market, style, risk level
- Subscribe to strategies (notification when confidence changes)

#### 4.4 — Mobile
- Responsive design optimization
- PWA for mobile homescreen

---

## Data & AI Strategy

### Do We Need a Custom-Trained Model?

**No. Not now, probably not ever.**

The AI's job is:
1. Translate user intent → strategy parameters (language task)
2. Pick appropriate indicators and rules (pattern matching)
3. Explain results in plain English (language task)

None of these require custom training. Well-prompted Claude/Gemini does all three better than a fine-tuned small model.

**When custom training would make sense (future):**
- If we have thousands of user strategies with backtest results, fine-tune on "which structures produce good scores"
- That dataset doesn't exist yet. Build platform first, collect data, consider fine-tuning later.

**Bottom line: Invest in better prompts and better data, not model training.**

### Model Routing Strategy

| Task | Model | Why |
|---|---|---|
| Intent extraction | Gemini Flash / Haiku | Fast, cheap, structured task |
| Follow-up questions | Gemini Flash / Haiku | Simple language task |
| Strategy generation (template) | Sonnet | Good parameter selection |
| Strategy generation (custom) | Sonnet or Opus | Deep reasoning needed |
| Result explanation | Sonnet | Nuanced, honest language |
| Chart display decision | Haiku | Simple yes/no logic |

### How AI Gets Market Data

The AI doesn't "access the internet." We fetch, structure, and inject into the prompt:

```
User submits prompt
        ↓
1. Load cached Market Snapshot (refreshed daily)
2. Fetch latest news headlines (cached, refresh every 6 hours)
3. Resolve mentioned assets (asset mapping table)
4. Pull current price data for relevant tickers (yfinance, cached 1hr)
        ↓
Construct AI prompt with all context
        ↓
AI generates context-aware response
```

### What Can and Cannot Be Done

**CAN do:**
- "I want to invest in small cap stocks" → maps to ticker universe, backtests momentum strategy
- "I want gold/silver/copper" → maps to commodity ETFs, backtests trend strategy
- "Where should I enter [stock]?" → entry rules with RSI/support levels, backtest validation
- "Is it a good time to invest?" → show historical analogues, probability distribution
- "What if markets crash 30%?" → stress test against named historical events

**CANNOT do (or shouldn't):**
- Predict the future — we show historical probability, not predictions
- Real-time trading signals — no live monitoring infrastructure (yet)
- Options/futures/F&O — our engine doesn't model options pricing or greeks
- Portfolio-level optimization — we test strategies individually, not portfolio allocation
- Leverage optimization — we can discuss it but should NOT optimize for it (regulatory + safety)

**Grey zone (do with caveats):**
- "Should I invest now or wait?" → show distribution of outcomes, let user decide
- Sector/thematic calls → backtest sector strategy, show data, don't recommend
- Leverage scenarios → show leveraged vs unleveraged, let user see the risk

---

## Research Homework

### Data Sources — Test These

| Source | What For | Action |
|---|---|---|
| **jugaad-data** (GitHub) | NSE/BSE direct data, no API key | `pip install jugaad-data`, test Nifty 50 stocks |
| **OpenBB SDK** (GitHub, 35k stars) | All-in-one data platform, 90+ sources | Install, compare quality vs yfinance |
| **Twelve Data** | Reliable backup API | Register free account, test 800 req/day |
| **CCXT** (GitHub, 35k stars) | Crypto data for Phase 4 | `pip install ccxt`, test Binance/CoinGecko |
| **NewsAPI.org** | Financial news headlines | Register free key, test headline quality |
| **GNews API** | Google News aggregator | Free tier: 100 req/day |

### Competitor Products — Use Them

| Product | Why | Action |
|---|---|---|
| **Composer.trade** | Closest competitor UI | Sign up, generate strategy with AI, study output format |
| **Smallcase.com** | Best beginner UX in India | Browse themes, study how they explain returns |
| **Magnifi** | Best conversational AI | Ask "should I invest in gold?" — study the tone |
| **TradingView** | Backtest benchmark | Run Pine Script backtest on AAPL, compare metrics |
| **Streak.tech** | Indian market algo | Create free strategy, see how they handle NSE data |

### GitHub Repos — Read the Code

| Repo | Why | What to Read |
|---|---|---|
| **ZipLime** | NL→strategy→backtest pipeline | AI prompt and strategy generation bridge |
| **TradingAgents** | Multi-agent decomposition | How they split into specialized agents |
| **fastquant** | Template API pattern | String identifiers → pre-built strategies |
| **Screeni-py** | NSE data handling | .NS ticker fetching and processing |
| **FinGPT** | Sentiment scoring | News→sentiment pipeline, pre-trained models |

### Books / Resources

| Resource | Why |
|---|---|
| **"Advances in Financial Machine Learning"** — Marcos López de Prado | Backtesting methodology, overfitting detection, walk-forward |
| **awesome-quant** (GitHub, 25k stars) | Master list of every quant finance library |

---

## Execution Timeline

```
Week 1-2:   Phase 1.1 (multi-source data fetcher) + 1.2 (cache fix)
             → Templates stop failing. Backtests return real data.

Week 3:     Phase 1.3 (asset mapping table) + 1.4 (backtester fixes)
             → Multi-ticker works. Position sizing works.

Week 4:     Phase 2.1 (market snapshot) + 2.2 (news headlines)
             → We have current market data.

Week 5:     Phase 2.3 (enhanced AI prompt with context)
             → AI generates context-aware strategies. Game changer.

Week 6-7:   Phase 3.1 (intent parser) + 3.2 (templates)
             → Simple Mode backend works.

Week 8-9:   Phase 3.3 (result translator) + 3.4 (conversational UI)
             → Simple Mode frontend ships.

Week 10:    Phase 4 polish, testing, edge cases
             → Production-ready.
```

**Each phase is independently valuable.** Even Phase 1 alone makes the current product actually work reliably.

---

## Architecture (Current + Planned)

```
                          ┌─────────────────┐
                          │   User Input     │
                          │  (prompt/form)   │
                          └────────┬────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
              [Simple Mode]  [Expert Mode]  [Template]
                    │              │              │
                    ▼              │              │
            ┌──────────────┐      │              │
            │ Intent Parser │      │              │
            │ (Haiku/Flash) │      │              │
            └──────┬───────┘      │              │
                   │              │              │
                   ▼              ▼              ▼
            ┌─────────────────────────────────────────┐
            │         AI Strategy Generator            │
            │  (Claude Sonnet / Gemini / OpenAI)       │
            │                                         │
            │  Injected Context:                      │
            │  - Market Snapshot (Phase 2)             │
            │  - News Headlines (Phase 2)              │
            │  - Asset Universe Mapping (Phase 1)      │
            │  - User Risk Profile                     │
            └────────────────┬────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ StrategyDef    │
                    │ (JSONB in DB)  │
                    └───────┬────────┘
                            │
                            ▼
     ┌─────────────────────────────────────────────┐
     │           Python Backtesting Engine           │
     │                                              │
     │  Data Fetcher (multi-source with fallback)   │
     │         ↓                                    │
     │  Indicator Calculator (23 indicators)        │
     │         ↓                                    │
     │  Backtest Loop (event-driven, multi-ticker)  │
     │         ↓                                    │
     │  Score Calculator (0-100 composite)          │
     │         ↓                                    │
     │  Walk-Forward Validation                     │
     │         ↓                                    │
     │  Confidence Scorer (regime+signal+vol)       │
     └────────────────┬────────────────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ Result        │
              │ Translator    │     ← Phase 3 (Simple Mode only)
              │ (Sonnet)      │
              └──────┬────────┘
                     │
          ┌──────────┼──────────┐
          │          │          │
    [Plain English] [Charts]  [Full Metrics]
    (Simple Mode)   (Smart)   (Expert Mode)
```

---

*This document is the single source of truth for StrategyForge v2 development.*
