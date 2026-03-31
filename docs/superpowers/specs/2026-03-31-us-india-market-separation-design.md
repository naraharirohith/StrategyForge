# US / India Market Structural Separation

**Date:** 2026-03-31
**Status:** Approved — ready for implementation

---

## Problem

StrategyForge serves two distinct markets (US equities, Indian equities) but the codebase treats them as one. This causes 47 identified mixing points: hardcoded USD commissions shown to Indian users, S&P 500 regime signals polluting India confidence scores, news not actually filtered by market, and capital/broker hints that are wrong for the wrong audience. As the product scales, these will compound.

---

## Goal

Structurally separate US and India into distinct routes with a single market config as the source of truth. No logic duplication — shared components accept a `market` prop. Backend bugs fixed by passing correct values from config rather than hardcoding.

---

## Section 1: URL Structure

```
/                        → Landing page (market selector)
/us                      → US strategy generator (home)
/us/dashboard            → US saved strategies
/us/strategy/[id]        → US strategy detail
/in                      → India strategy generator (home)
/in/dashboard            → India saved strategies
/in/strategy/[id]        → India strategy detail
```

Current page files move to shared components:

```
src/app/page.tsx              → src/components/pages/StrategyGeneratorPage.tsx
src/app/strategy/[id]/page.tsx → src/components/pages/StrategyDetailPage.tsx
src/app/dashboard/page.tsx    → src/components/pages/DashboardPage.tsx
```

New route files are thin wrappers only:

```tsx
// src/app/us/page.tsx
import { StrategyGeneratorPage } from "@/components/pages/StrategyGeneratorPage";
export default function USPage() { return <StrategyGeneratorPage market="US" />; }

// src/app/in/page.tsx
import { StrategyGeneratorPage } from "@/components/pages/StrategyGeneratorPage";
export default function INPage() { return <StrategyGeneratorPage market="IN" />; }
```

Same pattern for dashboard and strategy detail.

---

## Section 2: Market Config (Single Source of Truth)

New file: `apps/web/src/lib/marketConfig.ts`

```typescript
export type Market = "US" | "IN";

export interface MarketConfig {
  currency: string;
  currencySymbol: string;
  locale: string;
  benchmark: string;
  benchmarkLabel: string;
  benchmarkTicker: string;
  commissionPct: number;
  slippagePct: number;
  capitalExample: string;
  brokerContext: string;
  vixLabel: string;
  globalRiskTickers: string[];
  sectors: string[];
}

export const MARKET_CONFIG: Record<Market, MarketConfig> = {
  US: {
    currency: "USD",
    currencySymbol: "$",
    locale: "en-US",
    benchmark: "SPY",
    benchmarkLabel: "S&P 500",
    benchmarkTicker: "SPY",
    commissionPct: 0.1,
    slippagePct: 0.05,
    capitalExample: "$25,000",
    brokerContext: "Schwab / IBKR / TD Ameritrade compatible",
    vixLabel: "VIX",
    globalRiskTickers: ["^GSPC", "CL=F"],
    sectors: ["Technology", "Healthcare", "Financials", "Energy", "Consumer", "Industrials"],
  },
  IN: {
    currency: "INR",
    currencySymbol: "₹",
    locale: "en-IN",
    benchmark: "^NSEI",
    benchmarkLabel: "Nifty 50",
    benchmarkTicker: "^NSEI",
    commissionPct: 0.03,
    slippagePct: 0.1,
    capitalExample: "₹2,00,000",
    brokerContext: "Zerodha / Groww / Upstox compatible",
    vixLabel: "India VIX",
    globalRiskTickers: ["^NSEI", "CL=F", "INR=X"],
    sectors: ["IT", "Banking", "Pharma", "Energy", "Auto", "FMCG"],
  },
};
```

No component reads `MARKET_CONFIG` directly — they receive a `config` prop. This keeps components testable and market switching to a single prop change at the route level.

---

## Section 3: Component Architecture

`StrategyGeneratorPage`, `StrategyDetailPage`, and `DashboardPage` each accept:

```typescript
interface PageProps {
  market: Market;
}
```

Inside each, derive config once at the top:

```typescript
const config = MARKET_CONFIG[market];
```

Then pass `config` (or individual fields) down to child components. What changes inside `StrategyGeneratorPage`:

- Capital placeholder → `config.capitalExample`
- Broker hint text → `config.brokerContext`
- Sector list → `config.sectors`
- Commission/slippage sent to API → `config.commissionPct` / `config.slippagePct`
- All API calls include `market` query param (already partially done)

No business logic moves. Only market-specific literals are replaced with config lookups. Child components (StrategyCard, EquityCurve, CurrentSetupCard, etc.) are unchanged — they already receive data as props.

---

## Section 4: Backend Fixes

The API and engine already accept `market` as a query param on most endpoints. Changes fix mixing-point bugs rather than restructuring.

**Python engine (`apps/engine`):**

- `market_snapshot.py`: Replace hardcoded `["^GSPC", "CL=F"]` globals with per-market dict keyed by market param
- `confidence_scorer.py`: S&P 500 regime signal gated behind `market == "US"`; India uses `^INDIAVIX` for VIX signal
- `news_fetcher.py`: Remove `_market` underscore prefix on line ~98 so market param is actually forwarded to GNews queries
- `backtester.py`: Commission and slippage defaults remain as fallbacks; frontend now sends correct values from config

**Express API (`apps/api`):**

- `generator.ts`: Forward `commission_percent` and `slippage_percent` from request body to the engine (frontend sends market-config values, never hardcoded in transit)

**No schema changes.** The `market` field already exists on strategies in the DB. No migrations needed.

Principle: engine stays market-agnostic (accepts params), frontend config is the source of truth for market defaults, API passes them through.

---

## Section 5: Landing Page (`/`)

Minimal market selector — a choice screen, not a marketing page.

Layout: centered, two cards side by side (US / India). Each card shows flag, market name, exchange names. Click navigates directly to `/us` or `/in`.

**Persistence:** Last-used market stored in `localStorage` key `sf_market`. On revisit to `/`, auto-redirect after 1 second with a visible "Switch market" link to override.

**In-app switching:** Both `/us` and `/in` pages have a small "Switch to India / US" link in the top-right nav. Clicking returns to `/` (or directly to the other market's home).

No state shared between markets — switching is a full navigation. Dashboard filters strategies by market.

---

## Migration Path

1. Create `marketConfig.ts`
2. Move page files to `src/components/pages/`, add `market` prop, replace hardcoded literals with config lookups
3. Create thin route wrappers (`/us`, `/in`, `/us/dashboard`, etc.)
4. Create landing page at `/`
5. Add in-app market switcher to nav
6. Fix engine mixing points (commission defaults, S&P500 gate, news market param)
7. Update API generator to pass commission/slippage from request body
8. Redirect old `/` (strategy generator) to `/us` as default during transition

This order means the app stays functional at every step — old routes can coexist until step 8.

---

## Out of Scope

- Strategy templates per market (can be added to marketConfig later)
- Separate AI prompt templates per market (AI already handles this via market context injection)
- Multi-currency portfolio tracking
- Market-specific onboarding flows
