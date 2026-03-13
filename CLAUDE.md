# StrategyForge

AI-powered stock strategy generator with backtesting and confidence scoring. No trade execution — suggestion and analysis only.

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
```

## Key Files

- `packages/types/strategy.ts` — Core type system (StrategyDefinition, BacktestResult, ConfidenceScore). This is the contract between all services.
- `apps/api/src/ai/generator.ts` — AI strategy generation (Claude + OpenAI, model-agnostic)
- `apps/engine/main.py` — Backtesting engine, indicator calculator, score calculator
- `apps/api/prisma/schema.prisma` — Database schema
- `STRATEGYFORGE-PRD.md` — Full product spec. Read this for feature details.

## Code Style

- TypeScript strict mode, no `any` types
- Named exports, not default exports
- Tailwind utility classes, no custom CSS files
- Python: type hints, docstrings on public functions
- Use Prisma for all DB queries (never raw SQL)
- API responses: `{ success: boolean, data?: T, error?: string }`

## Important Rules

- NEVER implement trade execution. We only suggest and backtest.
- Every strategy MUST have a stop_loss exit rule. Reject strategies without one.
- Indian stock tickers use .NS suffix (RELIANCE.NS). US stocks are plain (AAPL).
- Strategy definitions are stored as JSONB in PostgreSQL `strategies.definition` column.
- Cache yfinance data in `ohlcv_cache` table. Don't fetch same ticker+timeframe more than once per hour.
- Include disclaimer on every frontend page: "For educational purposes only. Not investment advice."

## Testing

Use this test strategy to validate the backtest pipeline:
```bash
curl -X POST http://localhost:8001/backtest \
  -H "Content-Type: application/json" \
  -d '{"strategy": {"schema_version":"1.0.0","name":"Test","description":"Test","style":"momentum","risk_level":"moderate","universe":{"market":"US","asset_class":"equity","tickers":["AAPL"]},"timeframe":"1d","indicators":[{"id":"ema_50","type":"EMA","params":{"period":50}},{"id":"ema_200","type":"EMA","params":{"period":200}},{"id":"rsi_14","type":"RSI","params":{"period":14}}],"entry_rules":[{"id":"e1","name":"Golden Cross","side":"long","conditions":{"logic":"AND","conditions":[{"id":"c1","left":{"type":"indicator","indicator_id":"ema_50"},"operator":"crosses_above","right":{"type":"indicator","indicator_id":"ema_200"}},{"id":"c2","left":{"type":"indicator","indicator_id":"rsi_14"},"operator":"lt","right":{"type":"constant","value":60}}]},"position_sizing":{"method":"percent_of_portfolio","percent":20}}],"exit_rules":[{"id":"x1","name":"Stop Loss","type":"stop_loss","value":5,"priority":1},{"id":"x2","name":"Take Profit","type":"take_profit","value":15,"priority":2}],"risk_management":{"max_portfolio_drawdown_percent":15,"max_position_count":5},"backtest_config":{"initial_capital":100000,"currency":"USD","commission_percent":0.1,"slippage_percent":0.05}}}'
```
