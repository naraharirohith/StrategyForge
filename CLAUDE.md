# StrategyForge

AI-powered stock strategy generator with backtesting and confidence scoring. No trade execution — suggestion and analysis only.

## Product Positioning

StrategyForge fills a gap between Composer (no-code, shallow analysis) and QuantConnect (deep analysis, requires coding). The core loop is: **Describe idea → AI generates strategy → Backtest with honest scoring → Live confidence → Iterate**. Dual-market (US + India) support is a differentiator.

## Architecture

Monorepo with 3 services:
- `apps/web` — Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts
- `apps/api` — Express.js, TypeScript, Prisma ORM, PostgreSQL
- `apps/engine` — Python 3.11+, FastAPI, yfinance, pandas, numpy

Services communicate: Browser → Next.js (:3000) → Express API (:3001) → Python Engine (:8001)

## Commands

```bash
# Run services
npm run dev:api          # Express API on port 3001
npm run dev:web          # Next.js on port 3000
npm run dev:engine       # Python FastAPI on port 8001

# Database
cd apps/api && npx prisma migrate dev    # Run migrations
cd apps/api && npx prisma generate       # Generate client
cd apps/api && npx prisma studio         # DB browser

# Python engine
cd apps/engine && source venv/bin/activate && python main.py

# Tests
cd apps/engine && source venv/bin/activate && python -m pytest tests/ -v
```

## Key Files

### Type System
- `packages/types/strategy.ts` — Core type system (StrategyDefinition, BacktestResult, ConfidenceScore). Contract between all services.

### API Gateway
- `apps/api/src/index.ts` — Express app setup, mounts routers
- `apps/api/src/routes/strategies.ts` — Generate, backtest, confidence, list, detail endpoints
- `apps/api/src/routes/marketplace.ts` — Browse published strategies
- `apps/api/src/routes/market.ts` — Market snapshot proxy endpoints
- `apps/api/src/routes/health.ts` — Health check
- `apps/api/src/lib/prisma.ts` — Shared Prisma client + guest user
- `apps/api/src/middleware/errorHandler.ts` — Global error handler
- `apps/api/src/ai/generator.ts` — AI strategy generation with market context injection (Claude, OpenAI, Gemini, OpenRouter)

### Backtesting Engine
- `apps/engine/main.py` — FastAPI app + routes (imports from services/)
- `apps/engine/services/data_fetcher.py` — Multi-source OHLCV fetcher (yfinance → Twelve Data → Alpha Vantage)
- `apps/engine/services/data_sources.py` — Data source abstraction (YFinanceSource, TwelveDataSource, AlphaVantageSource)
- `apps/engine/services/data_validator.py` — OHLCV data quality validation
- `apps/engine/services/indicator_calculator.py` — 23 technical indicators
- `apps/engine/services/backtester.py` — Event-driven backtest loop (single + multi-ticker)
- `apps/engine/services/score_calculator.py` — Composite 0-100 StrategyScore
- `apps/engine/services/confidence_scorer.py` — Live confidence (regime, signal, volatility)
- `apps/engine/services/condition_evaluator.py` — Condition evaluation + proximity estimation
- `apps/engine/services/market_snapshot.py` — Market state: indices, VIX, sectors, regime, hot tickers
- `apps/engine/services/news_fetcher.py` — Financial news headlines (NewsAPI, GNews, Google RSS)
- `apps/engine/services/asset_universe.py` — Category-to-ticker mapping (US/IN sectors, themes, commodities)

### Frontend
- `apps/web/src/app/page.tsx` — Strategy generator (home page)
- `apps/web/src/app/strategy/[id]/page.tsx` — Strategy detail with tabs
- `apps/web/src/app/dashboard/page.tsx` — Saved strategies grid
- `apps/web/src/components/` — UI components (StrategyCard, EquityCurve, DrawdownChart, etc.)
- `apps/web/src/lib/api.ts` — API client functions
- `apps/web/src/lib/utils.ts` — Formatting helpers (currency-aware)

### Database
- `apps/api/prisma/schema.prisma` — Full schema (User, Strategy, BacktestRun, OhlcvCache, Subscription, GenerationLog)

## Code Style

- TypeScript strict mode, no `any` types
- Named exports, not default exports (except Next.js pages)
- Tailwind utility classes, no custom CSS files
- Python: type hints, docstrings on public functions
- Use Prisma for all DB queries (never raw SQL)
- API responses: `{ success: boolean, data?: T, error?: string }`
- Frontend currency-aware: use `fmtCurrency(n, currency)` not hardcoded `$`

## Important Rules

- NEVER implement trade execution. We only suggest and backtest.
- Every strategy MUST have a stop_loss exit rule. Reject strategies without one.
- Indian stock tickers use .NS suffix (RELIANCE.NS). US stocks are plain (AAPL).
- Strategy definitions are stored as JSONB in PostgreSQL `strategies.definition` column.
- Cache yfinance data in `ohlcv_cache` table. Don't fetch same ticker+timeframe more than once per hour.
- Include disclaimer on every frontend page: "For educational purposes only. Not investment advice."
- Show statistical significance warning when backtest has <30 trades.
- Always show benchmark comparison (buy-and-hold) on equity curves.
- Be honest about methodology limitations — transparency builds trust.

## Supported Indicators (23)

Moving Averages: SMA, EMA, WMA, VWAP
Oscillators: RSI, MACD, STOCH, CCI, WILLIAMS_R, MFI
Volatility: BBANDS, ATR, KELTNER, DONCHIAN
Volume: OBV, VOLUME_SMA
Trend: ADX, SUPERTREND, ICHIMOKU, PSAR
Price Action: SUPPORT, RESISTANCE, PIVOT_POINTS (stubs)
Derived: PRICE_CHANGE_PCT, HIGH_LOW_RANGE, GAP (stub)

## Testing

51 tests covering indicators, scoring, backtesting, and confidence scoring:
```bash
cd apps/engine && source venv/bin/activate && python -m pytest tests/ -v
```

Test strategy for pipeline validation:
```bash
curl -X POST http://localhost:8001/backtest \
  -H "Content-Type: application/json" \
  -d '{"strategy": {"schema_version":"1.0.0","name":"Test","description":"Test","style":"momentum","risk_level":"moderate","universe":{"market":"US","asset_class":"equity","tickers":["AAPL"]},"timeframe":"1d","indicators":[{"id":"ema_50","type":"EMA","params":{"period":50}},{"id":"ema_200","type":"EMA","params":{"period":200}},{"id":"rsi_14","type":"RSI","params":{"period":14}}],"entry_rules":[{"id":"e1","name":"Golden Cross","side":"long","conditions":{"logic":"AND","conditions":[{"id":"c1","left":{"type":"indicator","indicator_id":"ema_50"},"operator":"crosses_above","right":{"type":"indicator","indicator_id":"ema_200"}},{"id":"c2","left":{"type":"indicator","indicator_id":"rsi_14"},"operator":"lt","right":{"type":"constant","value":60}}]},"position_sizing":{"method":"percent_of_portfolio","percent":20}}],"exit_rules":[{"id":"x1","name":"Stop Loss","type":"stop_loss","value":5,"priority":1},{"id":"x2","name":"Take Profit","type":"take_profit","value":15,"priority":2}],"risk_management":{"max_portfolio_drawdown_percent":15,"max_position_count":5},"backtest_config":{"initial_capital":100000,"currency":"USD","commission_percent":0.1,"slippage_percent":0.05}}}'
```
