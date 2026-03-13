# StrategyForge — Product Requirements Document (PRD)

> **Purpose of this document**: This PRD is the single source of truth for building StrategyForge. It contains every architectural decision, schema definition, implementation detail, and constraint needed to build the product. If you are Claude Code (or any AI coding assistant), read this entire document before writing any code.

---

## 1. Product Overview

### What is StrategyForge?

StrategyForge is a web application where users describe their investment goals in natural language, and AI generates executable stock trading strategies. Users can backtest these strategies against historical data, see a composite confidence score based on current market conditions, view rebalancing suggestions, and (eventually) publish successful strategies to a marketplace where others can subscribe.

### What StrategyForge is NOT

- **NOT a trading platform**: We do not execute trades. We suggest strategies, backtest them, and score them.
- **NOT investment advice**: All output is educational/informational. Disclaimers are mandatory on every page.
- **NOT a copy-trading platform**: Users subscribe to strategy logic, not someone's live trades.

### Core Value Proposition

No existing platform combines:
1. AI strategy generation from natural language
2. Transparent backtesting with a composite scoring system
3. Live confidence scoring based on current market conditions
4. Rebalancing suggestions
5. A marketplace where strategy creators earn fees

---

## 2. Target Users

| User Type | Description | Primary Need |
|-----------|-------------|-------------|
| Retail Trader (India) | Trades NIFTY, BANKNIFTY, NSE stocks. Uses Zerodha/Groww. | Wants systematic strategies instead of gut feeling |
| Retail Trader (US) | Trades S&P 500, NASDAQ stocks. Uses Robinhood/Schwab. | Wants AI-generated strategies with backtested proof |
| Strategy Creator | Experienced trader who wants to monetize their knowledge | Publish strategies, earn subscription fees |
| Passive Investor | Wants to follow proven strategies without building their own | Browse marketplace, subscribe to top-scoring strategies |

---

## 3. Technical Architecture

### 3.1 Monorepo Structure

```
strategyforge/
├── apps/
│   ├── web/                    # Next.js 14 frontend
│   │   ├── app/                # App Router pages
│   │   │   ├── page.tsx                    # Landing / strategy generator
│   │   │   ├── dashboard/page.tsx          # User dashboard
│   │   │   ├── strategy/[id]/page.tsx      # Strategy detail + backtest results
│   │   │   ├── marketplace/page.tsx        # Browse published strategies
│   │   │   └── layout.tsx                  # Root layout
│   │   ├── components/
│   │   │   ├── strategy/
│   │   │   │   ├── StrategyInput.tsx       # Conversational input form
│   │   │   │   ├── StrategyCard.tsx        # Strategy preview card
│   │   │   │   ├── StrategyDetail.tsx      # Full strategy breakdown
│   │   │   │   └── StrategyJSON.tsx        # Raw JSON viewer (collapsible)
│   │   │   ├── backtest/
│   │   │   │   ├── EquityCurve.tsx         # Line chart of portfolio value over time
│   │   │   │   ├── DrawdownChart.tsx       # Drawdown visualization
│   │   │   │   ├── TradeTable.tsx          # Sortable table of all trades
│   │   │   │   ├── MonthlyReturns.tsx      # Heatmap grid of monthly returns
│   │   │   │   └── MetricsSummary.tsx      # Key metrics in card grid
│   │   │   ├── score/
│   │   │   │   ├── StrategyScore.tsx       # The 0-100 composite score display
│   │   │   │   ├── ScoreBreakdown.tsx      # Radar chart of 6 metrics
│   │   │   │   ├── GradeBadge.tsx          # S/A/B/C/D/F badge
│   │   │   │   └── ConfidenceScore.tsx     # Live confidence with 4 components
│   │   │   ├── rebalancing/
│   │   │   │   ├── RebalanceSuggestion.tsx # Rebalancing action cards
│   │   │   │   └── WeightDrift.tsx         # Current vs target weight chart
│   │   │   ├── marketplace/
│   │   │   │   ├── MarketplaceGrid.tsx     # Grid of published strategies
│   │   │   │   ├── FilterBar.tsx           # Market, style, risk, score filters
│   │   │   │   └── CreatorProfile.tsx      # Strategy creator card
│   │   │   └── ui/
│   │   │       ├── Header.tsx
│   │   │       ├── Sidebar.tsx
│   │   │       └── LoadingStates.tsx
│   │   ├── lib/
│   │   │   ├── api.ts                      # API client (fetch wrapper)
│   │   │   └── utils.ts                    # Formatting helpers
│   │   ├── package.json
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── next.config.js
│   │
│   ├── api/                    # Node.js API gateway
│   │   ├── src/
│   │   │   ├── index.ts                    # Express server entry
│   │   │   ├── ai/
│   │   │   │   └── generator.ts            # AI strategy generation (Claude + OpenAI)
│   │   │   ├── routes/
│   │   │   │   ├── strategies.ts           # CRUD + generate + backtest endpoints
│   │   │   │   ├── marketplace.ts          # Browse, subscribe, publish
│   │   │   │   └── users.ts               # Auth, profile, dashboard
│   │   │   └── middleware/
│   │   │       ├── auth.ts                 # JWT / session auth
│   │   │       └── rateLimit.ts            # Rate limiting for AI generation
│   │   ├── prisma/
│   │   │   ├── schema.prisma               # Database schema (PROVIDED)
│   │   │   └── seed.ts                     # Seed data
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── engine/                 # Python backtesting engine
│       ├── main.py                         # FastAPI app (PROVIDED)
│       ├── requirements.txt                # Python deps (PROVIDED)
│       ├── services/
│       │   ├── data_fetcher.py             # yfinance wrapper (extract from main.py)
│       │   ├── indicator_calculator.py     # Technical indicators (extract from main.py)
│       │   ├── backtester.py               # Core backtest loop (extract from main.py)
│       │   ├── score_calculator.py         # StrategyScore computation (extract from main.py)
│       │   └── confidence_scorer.py        # Live confidence scoring (NEW — build this)
│       └── tests/
│           └── test_backtest.py            # Test with known strategies
│
├── packages/
│   ├── types/
│   │   ├── strategy.ts                     # Core type system (PROVIDED)
│   │   ├── index.ts
│   │   └── package.json
│   └── shared/
│       └── constants.ts                    # Shared constants
│
├── .env.example                            # Environment template (PROVIDED)
├── package.json                            # Monorepo root with workspaces (PROVIDED)
└── README.md                               # Setup instructions (PROVIDED)
```

### 3.2 Tech Stack (LOCKED — do not change)

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS | SSR, modern React, Rohith's stack |
| Charts | Recharts (equity curves, drawdown) + custom SVG (score displays) | Lightweight, React-native |
| API Gateway | Express.js, TypeScript | Simple, Rohith's comfort zone |
| ORM | Prisma | Type-safe, great DX, Rohith's preference |
| Database | PostgreSQL | Rohith's experience, JSONB for strategy defs |
| AI Engine | Claude API (primary) + OpenAI (fallback), model-agnostic | Flexibility, cost optimization |
| Backtesting | Python 3.11+, FastAPI, pandas, numpy, yfinance | Best ecosystem for financial computation |
| Data Source | yfinance (free) | Supports US + Indian stocks, all timeframes |
| Auth | Clerk (or NextAuth for MVP) | Fast setup |
| Payments | Razorpay (India) + Stripe (global) — Phase 2 | Both markets covered |

### 3.3 Service Communication

```
Browser → Next.js (port 3000) → Express API (port 3001) → Python Engine (port 8001)
                                       ↓
                                  PostgreSQL
                                       ↓
                                  Claude/OpenAI API
```

- Frontend calls API gateway at `/api/*`
- API gateway calls Python engine at `ENGINE_URL/backtest` and `ENGINE_URL/confidence`
- API gateway calls Claude/OpenAI for strategy generation
- All strategy definitions stored as JSONB in PostgreSQL `strategies.definition` column

---

## 4. Core Strategy Schema

> **CRITICAL**: This schema is the contract that connects every component. The full TypeScript definition is in `packages/types/strategy.ts` (already provided). Below is a summary.

### 4.1 StrategyDefinition (the main type)

```typescript
interface StrategyDefinition {
  schema_version: "1.0.0";
  name: string;
  description: string;                    // AI-generated human explanation
  style: "momentum" | "mean_reversion" | "swing" | "positional" | "intraday" | "portfolio" | "hybrid";
  risk_level: "conservative" | "moderate" | "aggressive";
  universe: UniverseDefinition;           // What to trade (tickers or dynamic selection)
  timeframe: "5m" | "15m" | "1h" | "4h" | "1d" | "1w";
  indicators: IndicatorConfig[];          // Technical indicators with params
  entry_rules: EntryRule[];               // When to enter (conditions with AND/OR logic)
  exit_rules: ExitRule[];                 // When to exit (stop_loss MANDATORY)
  rebalancing?: RebalancingConfig;        // Portfolio rebalancing rules
  risk_management: RiskManagement;        // Portfolio-level guardrails
  backtest_config: BacktestConfig;        // Capital, commission, slippage, date range
  ai_metadata?: AIMetadata;               // Which model generated this, prompt hash, etc.
}
```

### 4.2 Supported Indicators (20+)

Moving Averages: SMA, EMA, WMA, VWAP
Oscillators: RSI, MACD, STOCH, CCI, WILLIAMS_R, MFI
Volatility: BBANDS, ATR, KELTNER, DONCHIAN
Volume: OBV, VOLUME_SMA
Trend: ADX, SUPERTREND, ICHIMOKU, PSAR
Price Action: SUPPORT, RESISTANCE, PIVOT_POINTS
Derived: PRICE_CHANGE_PCT, HIGH_LOW_RANGE, GAP

### 4.3 Condition System

Conditions use a `left operator right` pattern where left/right can be:
- `{ type: "indicator", indicator_id: "rsi_14" }` — reference an indicator
- `{ type: "price", field: "close" }` — reference OHLCV price
- `{ type: "constant", value: 30 }` — a fixed number
- `{ type: "indicator_prev", indicator_id: "ema_50", bars_ago: 1 }` — lagged value

Operators: `gt`, `gte`, `lt`, `lte`, `eq`, `crosses_above`, `crosses_below`, `between`

Conditions are grouped in `ConditionGroup` with `AND`/`OR` logic, supporting nesting.

### 4.4 Ticker Format

| Market | Format | Examples |
|--------|--------|---------|
| US Stocks | Plain symbol | AAPL, MSFT, GOOGL, TSLA, SPY |
| US Indices | ^PREFIX | ^GSPC (S&P 500), ^IXIC (NASDAQ) |
| Indian Stocks (NSE) | SYMBOL.NS | RELIANCE.NS, TCS.NS, HDFCBANK.NS |
| Indian Stocks (BSE) | SYMBOL.BO | RELIANCE.BO |
| Indian Indices | ^PREFIX | ^NSEI (NIFTY 50), ^NSEBANK (BANKNIFTY) |

### 4.5 Market-Specific Defaults

| Setting | US Market | Indian Market |
|---------|----------|---------------|
| Currency | USD | INR |
| Default Capital | $100,000 | ₹10,00,000 (10 lakh) |
| Commission | 0.1% | 0.03% (Zerodha) + 0.1% (STT/charges) |
| Slippage | 0.05% | 0.05% |
| Trading Hours | 09:30-16:00 ET | 09:15-15:30 IST |
| Trading Days | Mon-Fri | Mon-Fri |

---

## 5. Feature Specifications

### 5.1 Strategy Generation (AI Engine)

**User Flow:**
1. User lands on the main page
2. Sees a text input area with placeholder: "Describe your ideal trading strategy..."
3. Below the input: quick-select chips for Market (US/India), Risk Level, Style, Timeframe, Capital
4. User types: "I want a momentum strategy for top NIFTY50 stocks that uses RSI and moving average crossover, moderate risk, holding positions for 1-2 weeks, starting capital 5 lakh INR"
5. Clicks "Generate Strategy"
6. Loading state with progress messages ("Analyzing your requirements...", "Selecting indicators...", "Defining entry/exit logic...", "Building risk management rules...")
7. Strategy appears as a structured card showing: Name, Description, Style, Risk Level, Universe, Indicators used, Entry/Exit logic in plain English, Risk management rules
8. User can: "Backtest This Strategy" or "Modify & Regenerate" or "Save to My Strategies"

**AI Prompt System:**
- The system prompt in `apps/api/src/ai/generator.ts` instructs Claude/GPT to return ONLY valid JSON conforming to StrategyDefinition
- User preferences are mapped to structured fields before being sent to the LLM
- Response is parsed, validated (mandatory stop loss, risk management, etc.), and enriched with AI metadata
- If validation fails, the system retries once with error feedback appended to the prompt

**API Endpoint:**
```
POST /api/strategies/generate
Body: { description: string, preferences?: object, provider?: "claude" | "openai" }
Response: { success: boolean, strategy: StrategyDefinition, latency_ms: number }
```

### 5.2 Backtesting Engine

**User Flow:**
1. After strategy generation, user clicks "Backtest Strategy"
2. Loading state with estimated time ("Running backtest... ~10-30 seconds")
3. Results appear in a dashboard layout with:
   - **Hero section**: Total return %, StrategyScore (0-100) with grade badge, vs benchmark comparison
   - **Equity curve chart**: Line chart of portfolio value over time, with benchmark overlay
   - **Drawdown chart**: Area chart showing drawdown depth over time
   - **Metrics grid**: Cards showing Sharpe, Sortino, Win Rate, Profit Factor, Max Drawdown, Avg Holding Period, Best/Worst Trade
   - **Score breakdown**: Radar chart showing the 6 components of StrategyScore
   - **Trade log**: Sortable, filterable table of every trade (entry/exit date, price, P&L, reason)
   - **Monthly returns heatmap**: Calendar-style grid showing returns by month/year

**Implementation Details:**
- The Python engine (`apps/engine/main.py`) handles all computation
- Data is fetched via yfinance (cached in PostgreSQL `ohlcv_cache` table)
- Indicators are computed using the `IndicatorCalculator` class
- The backtest loop is event-driven: iterates bar-by-bar, evaluates conditions, simulates trades with slippage and commissions
- Results include equity curve, drawdown curve, all trades, monthly returns, and regime performance
- StrategyScore is computed by `ScoreCalculator` with 6 weighted metrics

**API Endpoint:**
```
POST /api/strategies/backtest
Body: { strategy: StrategyDefinition }
Response: { success: boolean, result: BacktestResult, duration_ms: number }
```

### 5.3 StrategyScore (0-100 Composite)

| Component | Weight | Scoring Logic |
|-----------|--------|--------------|
| Sharpe Ratio | 25% | 0 if ≤0, 100 if ≥3, linear between |
| Max Drawdown | 20% | 100 if ≤5%, 0 if ≥50%, linear between |
| Win Rate | 10% | 0 if ≤20%, 100 if ≥70%, linear between |
| Profit Factor | 15% | 0 if ≤0.5, 100 if ≥3, linear between |
| Consistency | 15% | Based on monthly return std dev. Low variance = high score |
| Regime Score | 15% | % of market regimes (bull/bear/sideways) where strategy is profitable |

**Grades:** S (90+), A (80+), B (70+), C (60+), D (40+), F (<40)
**Publishable:** Score ≥ 40
**Verified badge:** Score ≥ 70

### 5.4 Confidence Score (Live, Dynamic)

> This is what makes StrategyForge unique. The confidence score is NOT the backtest score. It's a dynamic assessment of how likely the strategy is to perform well RIGHT NOW, given current market conditions.

**Components:**

| Component | Weight | What It Measures |
|-----------|--------|-----------------|
| Backtest Strength | 40% | Historical backtest score (static) |
| Regime Fit | 30% | Is the current market regime (bull/bear/sideways) one where this strategy historically performs well? |
| Signal Proximity | 20% | How close is the strategy to triggering an entry/exit signal right now? |
| Volatility Context | 10% | Is current market volatility within the range the strategy was tested on? |

**Implementation:**
- Runs periodically (every hour for intraday strategies, every day for daily+ strategies)
- Fetches latest market data via yfinance
- Classifies current market regime using 50-day and 200-day moving averages + VIX/India VIX
- Evaluates current indicator values against strategy entry conditions to measure signal proximity
- Compares current volatility (ATR or VIX) against the strategy's tested volatility range
- Combines all components into 0-100 score with recommendation: strong_buy / buy / hold / reduce / exit

**API Endpoint:**
```
POST /api/strategies/:id/confidence
Response: { success: boolean, confidence: ConfidenceScore }
```

### 5.5 Rebalancing Suggestions

**When rebalancing is triggered:**
- Calendar-based: Daily, weekly, monthly, quarterly
- Drift-based: When any position's weight drifts >X% from target
- Signal-based: When indicator conditions are met

**What the suggestion includes:**
- List of actions: which tickers to buy/sell, current vs target weight, suggested quantity
- Urgency level: low (informational), medium (action recommended), high (immediate action needed)
- Reasoning: Why the rebalance was triggered, in plain English
- Estimated turnover and commission cost

**Display:**
- Appears as a card/banner on the strategy detail page when a rebalance is due
- Shows a side-by-side bar chart of current weights vs target weights
- Each action has a clear "Buy X shares" / "Sell Y shares" label
- User can dismiss or acknowledge (we don't execute)

### 5.6 Marketplace (Phase 2 — scaffold now, build later)

**For now, scaffold the database models and API routes but don't build the full UI. The marketplace needs:**
- Strategy publishing flow (minimum score of 40 to publish)
- Browse/filter page: by market, style, risk level, score, subscribers
- Strategy detail page (public version of backtest results)
- Subscription model: creator sets price ($5-50/month), platform takes 20%
- Creator profiles with track records

---

## 6. Database Schema

> The full Prisma schema is in `apps/api/prisma/schema.prisma` (already provided). Key models:

| Model | Purpose |
|-------|---------|
| User | Auth, plan tier (FREE/PRO/ENTERPRISE) |
| Strategy | Strategy definition (JSONB), scores, confidence, publishing status |
| BacktestRun | Individual backtest executions with full results (JSONB) |
| OhlcvCache | Cached market data to avoid redundant yfinance calls |
| Subscription | Marketplace subscriptions (subscriber → creator → strategy) |
| GenerationLog | AI generation audit trail (prompt, model, latency, success/failure) |

---

## 7. API Routes

### Strategies

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/strategies/generate | AI-generate a strategy from user input |
| POST | /api/strategies/backtest | Run backtest on a strategy definition |
| GET | /api/strategies | List user's saved strategies |
| GET | /api/strategies/:id | Get strategy details + latest backtest |
| POST | /api/strategies/:id/save | Save a generated strategy |
| POST | /api/strategies/:id/confidence | Get live confidence score |
| PUT | /api/strategies/:id | Update strategy |
| DELETE | /api/strategies/:id | Delete strategy |

### Marketplace (Phase 2 — scaffold routes)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/marketplace | Browse published strategies with filters |
| POST | /api/marketplace/:id/publish | Publish a strategy (score ≥ 40) |
| POST | /api/marketplace/:id/subscribe | Subscribe to a strategy |
| GET | /api/marketplace/creators/:id | Creator profile + strategies |

### System

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check (API + engine + DB) |

---

## 8. Frontend Pages & Components

### 8.1 Page: Strategy Generator (Home — `/`)

**Layout:**
- Clean, focused interface. Think ChatGPT input area but for trading strategies.
- Large text area: "Describe your ideal trading strategy..."
- Below: Quick-select chips in a horizontal scroll:
  - Market: [US] [India]
  - Risk: [Conservative] [Moderate] [Aggressive]
  - Style: [Momentum] [Swing] [Mean Reversion] [Positional] [Intraday]
  - Timeframe: [5 min] [1 hour] [Daily] [Weekly]
  - Capital input field with currency toggle (USD/INR)
- "Generate Strategy" button (prominent, primary color)
- Below: Recent strategies sidebar or history

**After generation:**
- Strategy card appears below the input
- Shows: Name, Description, Style badge, Risk badge, Market badge
- Expandable sections: Indicators Used, Entry Logic, Exit Logic, Risk Rules
- Action buttons: [Backtest] [Save] [Modify & Regenerate]

### 8.2 Page: Strategy Detail + Backtest (`/strategy/[id]`)

**Layout (tabs or scrollable sections):**

**Tab 1: Overview**
- Hero: Strategy name, description, badges (market, style, risk, grade)
- Score card: StrategyScore (0-100) with circular progress, grade badge, "Verified" if ≥70
- Confidence card: Live confidence score (0-100) with 4 component bars and recommendation badge
- Key metrics row: Total Return, Sharpe, Max Drawdown, Win Rate, Profit Factor, Total Trades

**Tab 2: Backtest Results**
- Equity curve (Recharts LineChart): portfolio value vs benchmark, with tooltips
- Drawdown chart (Recharts AreaChart): red-shaded area chart
- Monthly returns heatmap: grid with green (positive) / red (negative) cells
- Score breakdown: Radar chart or horizontal bar chart of 6 components

**Tab 3: Trades**
- Full trade table with columns: #, Ticker, Side, Entry Date, Entry Price, Exit Date, Exit Price, P&L ($), P&L (%), Holding Period, Exit Reason
- Sortable by any column, filterable by ticker/side/exit reason
- Summary row: totals and averages

**Tab 4: Strategy Logic**
- Indicators table: ID, Type, Parameters
- Entry rules: rendered as human-readable logic ("IF RSI(14) crosses below 30 AND Price > SMA(200) THEN buy")
- Exit rules: rendered similarly
- Risk management: max drawdown, position limits, etc.
- Raw JSON viewer (collapsible)

**Tab 5: Rebalancing (if applicable)**
- Current vs target weight horizontal bar chart
- Rebalancing suggestion card (if triggered)
- Rebalance history (past suggestions)

### 8.3 Page: Dashboard (`/dashboard`)

- Grid of user's saved strategies with cards showing: name, market, score, confidence, last backtest date
- Quick actions: Run Backtest, View Details, Delete
- Generation usage counter (X/3 free tier or unlimited for Pro)

### 8.4 Page: Marketplace (`/marketplace`) — Phase 2

- Filter bar: Market, Style, Risk, Min Score, Sort By
- Grid of strategy cards: name, creator, score, subscribers, price, market badge
- Click → public strategy detail page (backtest results, no raw JSON)

---

## 9. UI/UX Guidelines

### Design System

- **Font**: Inter (body) + JetBrains Mono (code/numbers/metrics)
- **Color palette**: 
  - Primary: Blue (#2563EB)
  - Success/Profit: Green (#16A34A)
  - Loss/Danger: Red (#DC2626)
  - Warning: Amber (#D97706)
  - Background: White (#FFFFFF) / Slate-50 (#F8FAFC) for cards
  - Text: Slate-900 (#0F172A) primary, Slate-500 (#64748B) secondary
- **Grade colors**: S=Gold, A=Purple, B=Blue, C=Green, D=Yellow, F=Red
- **Dark mode**: Support via Tailwind `dark:` classes (optional for MVP)

### Component Patterns

- Cards with subtle border and shadow (not flat, not heavy)
- Metric values in large JetBrains Mono font with percentage/currency formatting
- Loading states: skeleton screens, not spinners (except for AI generation which gets a progress stepper)
- Responsive: works on mobile but optimized for desktop (traders use desktops)
- Charts: clean, minimal gridlines, thick lines for equity curves, proper tooltips

---

## 10. Build Phases & Priority

### Phase 1: Core Engine (BUILD THIS FIRST)

Priority order:
1. **Project setup**: Install all deps, configure monorepo, run Prisma migrations
2. **Python engine**: Get `main.py` running, test with a hardcoded strategy
3. **AI generator**: Get `generator.ts` working with Claude API, validate output
4. **API gateway**: Wire Express routes → AI generator → Python engine
5. **Frontend — Generator page**: Input form → API call → display strategy card
6. **Frontend — Backtest results**: Equity curve, drawdown, metrics, trade table
7. **Frontend — StrategyScore display**: Score card, breakdown chart, grade badge

### Phase 2: Live Features

8. **Confidence Score engine**: Build `confidence_scorer.py`, wire to API
9. **Frontend — Confidence display**: Live score card with 4 components
10. **Rebalancing engine**: Build rebalancing logic in Python
11. **Frontend — Rebalancing UI**: Weight drift chart, suggestion cards

### Phase 3: Marketplace & Scale

12. Marketplace API routes and frontend
13. Auth (Clerk) + user accounts
14. Payments (Stripe/Razorpay)
15. Strategy publishing flow

---

## 11. Files Already Provided

These files are COMPLETE and should be used as-is (with minor fixes if needed during setup):

| File | Status | Description |
|------|--------|------------|
| `packages/types/strategy.ts` | ✅ COMPLETE | Full type system (~400 lines) |
| `apps/api/src/ai/generator.ts` | ✅ COMPLETE | AI engine with Claude + OpenAI adapters, system prompt, validation |
| `apps/engine/main.py` | ✅ COMPLETE | Python backtesting engine with FastAPI, indicators, score calculator, condition evaluator |
| `apps/api/prisma/schema.prisma` | ✅ COMPLETE | Full database schema |
| `apps/api/src/index.ts` | ✅ COMPLETE | Express API gateway (basic routes) |
| `apps/engine/requirements.txt` | ✅ COMPLETE | Python dependencies |
| `package.json` (root) | ✅ COMPLETE | Monorepo config |
| `.env.example` | ✅ COMPLETE | Environment template |

**What needs to be built:**
- `apps/web/` — Entire Next.js frontend
- `apps/api/src/routes/` — Expanded route files (extract from index.ts)
- `apps/engine/services/confidence_scorer.py` — Live confidence scoring
- Tests
- Deployment config

---

## 12. Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/strategyforge"

# API
PORT=3001
ENGINE_URL=http://localhost:8001

# AI Providers (at least one required)
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-xxxxx

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 13. Setup Commands

```bash
# 1. Root
cd strategyforge
npm install

# 2. API + Database
cd apps/api
npm install
npx prisma generate
npx prisma migrate dev --name init

# 3. Python engine
cd ../engine
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 4. Frontend
cd ../web
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"
npm install recharts lucide-react

# 5. Run all services
# Terminal 1: cd apps/engine && python main.py
# Terminal 2: cd apps/api && npm run dev
# Terminal 3: cd apps/web && npm run dev
```

---

## 14. Testing Strategy

**Hardcoded test strategy for development** (use this to test the pipeline before AI generation works):

```json
{
  "schema_version": "1.0.0",
  "name": "Golden Cross RSI Filter - AAPL",
  "description": "Buy when 50-day EMA crosses above 200-day EMA and RSI is below 60. Sell on stop loss or RSI overbought.",
  "style": "momentum",
  "risk_level": "moderate",
  "universe": {
    "market": "US",
    "asset_class": "equity",
    "tickers": ["AAPL"]
  },
  "timeframe": "1d",
  "indicators": [
    { "id": "ema_50", "type": "EMA", "params": { "period": 50 } },
    { "id": "ema_200", "type": "EMA", "params": { "period": 200 } },
    { "id": "rsi_14", "type": "RSI", "params": { "period": 14 } }
  ],
  "entry_rules": [{
    "id": "entry_1",
    "name": "Golden Cross with RSI Filter",
    "side": "long",
    "conditions": {
      "logic": "AND",
      "conditions": [
        {
          "id": "c1",
          "left": { "type": "indicator", "indicator_id": "ema_50" },
          "operator": "crosses_above",
          "right": { "type": "indicator", "indicator_id": "ema_200" },
          "description": "EMA(50) crosses above EMA(200)"
        },
        {
          "id": "c2",
          "left": { "type": "indicator", "indicator_id": "rsi_14" },
          "operator": "lt",
          "right": { "type": "constant", "value": 60 },
          "description": "RSI(14) is below 60 (not overbought)"
        }
      ]
    },
    "position_sizing": { "method": "percent_of_portfolio", "percent": 20 },
    "cooldown_bars": 5
  }],
  "exit_rules": [
    { "id": "exit_sl", "name": "Stop Loss", "type": "stop_loss", "value": 5, "priority": 1 },
    { "id": "exit_tp", "name": "Take Profit", "type": "take_profit", "value": 15, "priority": 2 },
    { "id": "exit_trail", "name": "Trailing Stop", "type": "trailing_stop", "value": 8, "priority": 3 }
  ],
  "risk_management": {
    "max_portfolio_drawdown_percent": 15,
    "max_position_count": 5,
    "max_single_position_percent": 25
  },
  "backtest_config": {
    "initial_capital": 100000,
    "currency": "USD",
    "commission_percent": 0.1,
    "slippage_percent": 0.05
  }
}
```

Use this JSON to:
1. Test the Python backtest endpoint: `POST http://localhost:8001/backtest`
2. Test the API gateway passthrough: `POST http://localhost:3001/api/strategies/backtest`
3. Test the frontend rendering of backtest results

---

## 15. Key Constraints & Rules

1. **No trade execution**: We only suggest and backtest. Never connect to broker APIs for executing trades.
2. **Mandatory disclaimers**: Every page must include: "This is for educational purposes only. Past performance does not guarantee future results. This is not investment advice."
3. **Stop loss is mandatory**: The AI generator and validator must reject any strategy without a stop_loss exit rule.
4. **yfinance rate limits**: Cache aggressively. Don't fetch the same ticker+timeframe more than once per hour for daily data, once per 5 minutes for intraday.
5. **Strategy JSON is immutable after backtest**: Once a backtest is run, the strategy definition used for that run is frozen. Users can create new versions but can't retroactively change backtested strategies.
6. **Indian market specifics**: Use .NS suffix for NSE, .BO for BSE. Commission structure is different (include STT). Trading hours are 09:15-15:30 IST.
7. **Score recalculation**: StrategyScore is static per backtest run. Confidence Score is dynamic and updated periodically.

---

## 16. Glossary

| Term | Definition |
|------|-----------|
| StrategyDefinition | The complete JSON spec of a trading strategy |
| StrategyScore | Static composite 0-100 rating from backtest results |
| ConfidenceScore | Dynamic 0-100 rating based on current market conditions |
| Universe | The set of assets a strategy trades |
| Condition | A boolean expression comparing two values (indicator, price, constant) |
| ConditionGroup | AND/OR group of conditions (supports nesting) |
| Regime | Market classification: bull, bear, or sideways |
| Walk-Forward | Backtest validation method that tests on unseen data |
| Rebalancing | Adjusting position weights back to targets |
| Grade | Letter grade (S/A/B/C/D/F) derived from StrategyScore |

---

*End of PRD. All architectural decisions are final. Build in the priority order specified in Section 10.*
