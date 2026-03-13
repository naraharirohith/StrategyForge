# StrategyForge

AI-powered stock strategy generator with backtesting, confidence scoring, and marketplace.

## Architecture

```
strategyforge/
├── apps/
│   ├── web/          # Next.js frontend (React + TypeScript + Tailwind)
│   ├── api/          # Node.js API gateway (Express + Prisma + PostgreSQL)
│   └── engine/       # Python backtesting engine (FastAPI + yfinance + pandas)
├── packages/
│   ├── types/        # Shared TypeScript types (Strategy schema)
│   └── shared/       # Shared utilities
└── package.json      # Monorepo root (npm workspaces)
```

## Core Flow

```
User Input → AI Generation (Claude/GPT) → Strategy JSON → Backtesting Engine → StrategyScore
                                                                ↓
                                                      Confidence Score (live)
                                                                ↓
                                                    Marketplace (publish & subscribe)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts |
| API Gateway | Express, Prisma, PostgreSQL |
| AI Engine | Claude API + OpenAI (model-agnostic) |
| Backtesting | Python, FastAPI, yfinance, pandas, numpy |
| Database | PostgreSQL with Prisma ORM |
| Data | yfinance (free: US + Indian stocks) |

## Setup

### Prerequisites
- Node.js 18+
- Python 3.11+

### First-Time Setup

```bash
# 1. Install Node.js dependencies
npm install
cd apps/api && npm install
cd ../web && npm install

# 2. Setup Python engine
cd ../engine
python -m venv venv
source venv/Scripts/activate  # Windows (Git Bash/MINGW)
# source venv/bin/activate    # macOS/Linux
pip install -r requirements.txt

# 3. Setup database (uses Prisma Postgres cloud)
cd ../api
cp ../../.env.example .env
# Edit .env with your DATABASE_URL from Prisma Postgres
npx prisma migrate dev --name init
npx prisma generate
```

---

## Starting the Project

Open 3 terminals and run each service:

### Terminal 1: Python Engine (port 8001)
```bash
cd apps/engine
source venv/Scripts/activate  # Windows
python main.py
```

### Terminal 2: API Gateway (port 3001)
```bash
cd apps/api
npm run dev
```

### Terminal 3: Frontend (port 3000)
```bash
cd apps/web
npm run dev
```

---

## Verify Services

```bash
# Check Python engine
curl http://localhost:8001/health

# Check API gateway (includes engine + database status)
curl http://localhost:3001/api/health

# Frontend
# Open http://localhost:3000 in browser
```

Expected API health response:
```json
{
  "status": "ok",
  "api_version": "0.1.0",
  "engine": { "status": "ok", ... },
  "database": "connected"
}
```

---

## Quick Test: Backtest Pipeline

```bash
curl -X POST http://localhost:8001/backtest \
  -H "Content-Type: application/json" \
  -d '{"strategy": {"schema_version":"1.0.0","name":"Test","description":"Test","style":"momentum","risk_level":"moderate","universe":{"market":"US","asset_class":"equity","tickers":["AAPL"]},"timeframe":"1d","indicators":[{"id":"ema_50","type":"EMA","params":{"period":50}},{"id":"ema_200","type":"EMA","params":{"period":200}},{"id":"rsi_14","type":"RSI","params":{"period":14}}],"entry_rules":[{"id":"e1","name":"Golden Cross","side":"long","conditions":{"logic":"AND","conditions":[{"id":"c1","left":{"type":"indicator","indicator_id":"ema_50"},"operator":"crosses_above","right":{"type":"indicator","indicator_id":"ema_200"}},{"id":"c2","left":{"type":"indicator","indicator_id":"rsi_14"},"operator":"lt","right":{"type":"constant","value":60}}]},"position_sizing":{"method":"percent_of_portfolio","percent":20}}],"exit_rules":[{"id":"x1","name":"Stop Loss","type":"stop_loss","value":5,"priority":1},{"id":"x2","name":"Take Profit","type":"take_profit","value":15,"priority":2}],"risk_management":{"max_portfolio_drawdown_percent":15,"max_position_count":5},"backtest_config":{"initial_capital":100000,"currency":"USD","commission_percent":0.1,"slippage_percent":0.05}}}'
```

Should return `{"success": true, "result": {...}}` with trades and score.

## Strategy Schema

The core `StrategyDefinition` type in `packages/types/strategy.ts` is the contract between all components. It defines:

- **Universe**: Which stocks to trade (US/India, explicit tickers or dynamic selection)
- **Indicators**: Technical analysis building blocks (20+ supported)
- **Entry/Exit Rules**: Condition groups with AND/OR logic, crossover detection
- **Position Sizing**: Fixed, percentage, risk-based, or volatility-adjusted
- **Rebalancing**: Calendar, drift-based, or signal-triggered
- **Risk Management**: Drawdown limits, position limits, sector caps

## Markets Supported

| Market | Tickers | Timeframes | Data Source |
|--------|---------|-----------|-------------|
| US | S&P 500, NASDAQ, any NYSE/NASDAQ stock | 5m, 15m, 1h, 1d, 1w | yfinance |
| India | NSE/BSE stocks (.NS/.BO suffix), NIFTY, BANKNIFTY | 5m, 15m, 1h, 1d, 1w | yfinance |

## StrategyScore (0-100)

| Metric | Weight | Description |
|--------|--------|------------|
| Sharpe Ratio | 25% | Risk-adjusted returns |
| Max Drawdown | 20% | Worst peak-to-trough decline |
| Win Rate | 10% | Percentage of profitable trades |
| Profit Factor | 15% | Gross profit / Gross loss |
| Consistency | 15% | Monthly return variance |
| Regime Score | 15% | Performance across bull/bear/sideways |

Grades: S (90+), A (80+), B (70+), C (60+), D (40+), F (<40)

## License

MIT
