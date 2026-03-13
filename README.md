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
- PostgreSQL 15+

### 1. Clone and install
```bash
git clone <repo>
cd strategyforge
npm install
```

### 2. Setup database
```bash
cp .env.example .env
# Edit .env with your PostgreSQL connection string and API keys
cd apps/api
npx prisma migrate dev --name init
```

### 3. Setup Python engine
```bash
cd apps/engine
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### 4. Run all services
```bash
# Terminal 1: Python engine
npm run dev:engine

# Terminal 2: Node.js API
npm run dev:api

# Terminal 3: Next.js frontend
npm run dev:web
```

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
