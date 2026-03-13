# StrategyForge — Build Plan

## Phase 1: Core Engine (Current)

- [x] Strategy JSON schema (`packages/types/strategy.ts`)
- [x] AI generation engine (`apps/api/src/ai/generator.ts`)
- [x] Python backtesting engine (`apps/engine/main.py`)
- [x] Prisma database schema (`apps/api/prisma/schema.prisma`)
- [x] Express API gateway (`apps/api/src/index.ts`)
- [x] CLAUDE.md + PRD documentation
- [ ] Project setup: install all deps, run migrations, verify services start
- [ ] Test backtest pipeline with hardcoded strategy (AAPL golden cross)
- [ ] Test AI generation with Claude API key
- [ ] Next.js frontend: Strategy generator page (input form → API → display result)
- [ ] Next.js frontend: Backtest results dashboard (equity curve, metrics, trades)
- [ ] Next.js frontend: StrategyScore display (score card, breakdown, grade badge)

## Phase 2: Live Features

- [ ] Confidence Score engine (`apps/engine/services/confidence_scorer.py`)
- [ ] Confidence Score API endpoint
- [ ] Confidence Score frontend component
- [ ] Rebalancing engine and suggestions
- [ ] Rebalancing frontend UI (weight drift chart, action cards)
- [ ] Dashboard page (list saved strategies)

## Phase 3: Marketplace & Auth

- [ ] Auth (Clerk or NextAuth)
- [ ] User accounts and strategy ownership
- [ ] Marketplace browse/filter page
- [ ] Strategy publishing flow (min score 40)
- [ ] Subscription system
- [ ] Payments (Stripe + Razorpay)

## Current Focus
Phase 1 — get the core pipeline working end-to-end: user input → AI generates strategy → backtest runs → results display on frontend.
