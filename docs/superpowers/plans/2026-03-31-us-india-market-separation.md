# US / India Market Structural Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Structurally separate US and India into `/us` and `/in` routes, with a market selector landing page at `/` and a single `marketConfig.ts` as the source of truth for all market-specific values.

**Architecture:** Move `page.tsx`, `dashboard/page.tsx`, and `strategy/[id]/page.tsx` to shared components under `src/components/pages/` that accept a `market` prop. Thin route wrappers at the new URLs pass the correct market. Backend bugs (wrong commissions, S&P500 in India confidence, news market param ignored) are fixed by passing config values through rather than hardcoding.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Python FastAPI, Express.js

---

## File Map

| Action | Path |
|--------|------|
| **Create** | `apps/web/src/lib/marketConfig.ts` |
| **Create** | `apps/web/src/components/pages/StrategyGeneratorPage.tsx` |
| **Create** | `apps/web/src/app/us/page.tsx` |
| **Create** | `apps/web/src/app/in/page.tsx` |
| **Create** | `apps/web/src/components/pages/StrategyDetailPage.tsx` |
| **Create** | `apps/web/src/app/us/strategy/[id]/page.tsx` |
| **Create** | `apps/web/src/app/in/strategy/[id]/page.tsx` |
| **Create** | `apps/web/src/components/pages/DashboardPage.tsx` |
| **Create** | `apps/web/src/app/us/dashboard/page.tsx` |
| **Create** | `apps/web/src/app/in/dashboard/page.tsx` |
| **Modify** | `apps/web/src/app/page.tsx` → becomes landing page |
| **Modify** | `apps/web/src/app/dashboard/page.tsx` → redirect to `/us/dashboard` |
| **Modify** | `apps/web/src/app/strategy/[id]/page.tsx` → redirect to `/us/strategy/[id]` |
| **Modify** | `apps/engine/services/news_fetcher.py` |
| **Modify** | `apps/engine/services/confidence_scorer.py` |
| **Modify** | `apps/api/src/ai/generator.ts` |

---

## Task 1: Create marketConfig.ts

**Files:**
- Create: `apps/web/src/lib/marketConfig.ts`

- [ ] **Step 1: Create the file**

```typescript
// apps/web/src/lib/marketConfig.ts

export type Market = "US" | "IN";

export interface SectorTile {
  label: string;
  value: string;
  icon: string;
}

export interface MarketConfig {
  flag: string;
  label: string;
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
  sectors: SectorTile[];
  promptHint: string;
}

export const MARKET_CONFIG: Record<Market, MarketConfig> = {
  US: {
    flag: "🇺🇸",
    label: "US",
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
    sectors: [
      { label: "Technology", value: "technology", icon: "💻" },
      { label: "Healthcare", value: "healthcare", icon: "🏥" },
      { label: "Financials", value: "financials", icon: "🏦" },
      { label: "Energy", value: "energy", icon: "⚡" },
      { label: "Consumer", value: "consumer", icon: "🛍️" },
      { label: "Industrials", value: "industrials", icon: "🏭" },
    ],
    promptHint: "e.g. I want to invest in tech stocks with good momentum",
  },
  IN: {
    flag: "🇮🇳",
    label: "India",
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
    sectors: [
      { label: "IT", value: "it", icon: "💻" },
      { label: "Banking", value: "banking", icon: "🏦" },
      { label: "Pharma", value: "pharma", icon: "💊" },
      { label: "Energy", value: "energy", icon: "⚡" },
      { label: "Auto", value: "auto", icon: "🚗" },
      { label: "FMCG", value: "fmcg", icon: "🛒" },
    ],
    promptHint: "e.g. I want to invest in Nifty IT stocks with strong momentum",
  },
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors from `src/lib/marketConfig.ts`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/marketConfig.ts
git commit -m "feat: add marketConfig.ts as single source of truth for market-specific values"
```

---

## Task 2: Create StrategyGeneratorPage component

**Files:**
- Create: `apps/web/src/components/pages/StrategyGeneratorPage.tsx`
- The content is the full content of `apps/web/src/app/page.tsx` with the changes below applied.

Read `apps/web/src/app/page.tsx` first (it is ~700 lines), then create `apps/web/src/components/pages/StrategyGeneratorPage.tsx` with these precise changes:

- [ ] **Step 1: Copy page.tsx to the new location and apply changes**

The new file `apps/web/src/components/pages/StrategyGeneratorPage.tsx` starts with the same content as `apps/web/src/app/page.tsx` with these modifications:

**a) Replace the top-of-file local type/interface/constant block.** Remove these lines entirely:

```typescript
type Market = "US" | "IN";

interface SectorTile {
  label: string;
  value: string;
  icon: string;
}

interface MarketConfig {
  flag: string;
  label: string;
  currency: string;
  sectors: SectorTile[];
  promptHint: string;
}

// ... and the entire MARKET_CONFIG constant (lines 52-81 in page.tsx)
const MARKET_CONFIG: Record<Market, MarketConfig> = { ... };
```

Replace with a single import:

```typescript
import { type Market, type SectorTile, MARKET_CONFIG } from "@/lib/marketConfig";
```

**b) Add a `Props` interface and update the component signature.** Replace:

```typescript
export default function Home() {
  const [mode,        setMode]        = useState<"simple" | "expert">("simple");
  const [market,      setMarket]      = useState<Market>("US");
```

With:

```typescript
interface Props {
  market: Market;
}

export function StrategyGeneratorPage({ market }: Props) {
  const [mode, setMode] = useState<"simple" | "expert">("simple");
```

(Remove the `market` useState line — market is now a prop.)

**c) Remove the market toggle UI block.** Remove the entire JSX block (inside Expert Mode) that renders the market toggle buttons. It starts with:

```tsx
{/* Market Toggle */}
<div className="flex gap-2 mb-6">
  {(Object.keys(MARKET_CONFIG) as Market[]).map((m) => (
    <button
      key={m}
      onClick={() => {
        setMarket(m);
        ...
      }}
      ...
    >
```

And ends with the closing `</div>` after the last button. Delete this entire block.

**d) Add market switcher link to the Hero section.** After the `<p className="mt-2 text-sm text-gray-500">` hero subtitle, add:

```tsx
<p className="mt-3 text-xs text-gray-600">
  <a href="/" className="hover:text-gray-400 transition-colors">
    ← Switch market
  </a>
  <span className="mx-2 text-gray-700">·</span>
  <span className="text-gray-500">{MARKET_CONFIG[market].flag} {MARKET_CONFIG[market].label}</span>
</p>
```

**e) Pass commission and slippage in the generateStrategy call.** The current call at line ~184 passes:

```typescript
const data = await generateStrategy(
  descriptionToUse,
  { market, currency: MARKET_CONFIG[market].currency },
  provider,
);
```

Change to:

```typescript
const config = MARKET_CONFIG[market];
const data = await generateStrategy(
  descriptionToUse,
  {
    market,
    currency: config.currency,
    commission_percent: config.commissionPct,
    slippage_percent: config.slippagePct,
  },
  provider,
);
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/pages/StrategyGeneratorPage.tsx
git commit -m "feat: extract StrategyGeneratorPage to shared component accepting market prop"
```

---

## Task 3: Create /us and /in route wrappers for strategy generator

**Files:**
- Create: `apps/web/src/app/us/page.tsx`
- Create: `apps/web/src/app/in/page.tsx`

- [ ] **Step 1: Create the /us route**

```typescript
// apps/web/src/app/us/page.tsx
import { StrategyGeneratorPage } from "@/components/pages/StrategyGeneratorPage";

export default function USStrategyPage() {
  return <StrategyGeneratorPage market="US" />;
}
```

- [ ] **Step 2: Create the /in route**

```typescript
// apps/web/src/app/in/page.tsx
import { StrategyGeneratorPage } from "@/components/pages/StrategyGeneratorPage";

export default function INStrategyPage() {
  return <StrategyGeneratorPage market="IN" />;
}
```

- [ ] **Step 3: Verify both routes work**

Start the dev server and navigate to `http://localhost:3000/us` and `http://localhost:3000/in`. Both should render the strategy generator. The market toggle is gone; the market is fixed per route. The "← Switch market" link should appear and navigate to `/`.

```bash
cd apps/web && npm run dev
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/us/page.tsx apps/web/src/app/in/page.tsx
git commit -m "feat: add /us and /in strategy generator routes"
```

---

## Task 4: Create StrategyDetailPage component

**Files:**
- Create: `apps/web/src/components/pages/StrategyDetailPage.tsx`

Read `apps/web/src/app/strategy/[id]/page.tsx` in full, then create `apps/web/src/components/pages/StrategyDetailPage.tsx` with these changes:

- [ ] **Step 1: Copy and modify the strategy detail page**

The new file starts with the full content of `apps/web/src/app/strategy/[id]/page.tsx` with these modifications:

**a) Add `market` prop** — replace the existing component signature:

```typescript
// existing (uses useParams to get id)
export default function StrategyDetailPage() {
  const params = useParams();
  const id = params.id as string;
```

With:

```typescript
import { type Market, MARKET_CONFIG } from "@/lib/marketConfig";

interface Props {
  market: Market;
}

export function StrategyDetailPage({ market }: Props) {
  const params = useParams();
  const id = params.id as string;
  const config = MARKET_CONFIG[market];
```

**b) Fix the "New Strategy" link** — find the `href="/"` in the dashboard/back link and change to:

```tsx
href={`/${market.toLowerCase()}`}
```

**c) Add market switcher** — in the header area next to the back link, add:

```tsx
<a href="/" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
  ← Switch market
</a>
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/pages/StrategyDetailPage.tsx
git commit -m "feat: extract StrategyDetailPage to shared component accepting market prop"
```

---

## Task 5: Create /us/strategy/[id] and /in/strategy/[id] routes

**Files:**
- Create: `apps/web/src/app/us/strategy/[id]/page.tsx`
- Create: `apps/web/src/app/in/strategy/[id]/page.tsx`

- [ ] **Step 1: Create /us/strategy/[id]**

```typescript
// apps/web/src/app/us/strategy/[id]/page.tsx
import { StrategyDetailPage } from "@/components/pages/StrategyDetailPage";

export default function USStrategyDetailPage() {
  return <StrategyDetailPage market="US" />;
}
```

- [ ] **Step 2: Create /in/strategy/[id]**

```typescript
// apps/web/src/app/in/strategy/[id]/page.tsx
import { StrategyDetailPage } from "@/components/pages/StrategyDetailPage";

export default function INStrategyDetailPage() {
  return <StrategyDetailPage market="IN" />;
}
```

- [ ] **Step 3: Verify routing**

Navigate to `http://localhost:3000/us/strategy/<any-id>` and `http://localhost:3000/in/strategy/<any-id>`. Should render strategy detail (or a not-found state if the ID doesn't exist).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/us/strategy apps/web/src/app/in/strategy
git commit -m "feat: add /us/strategy/[id] and /in/strategy/[id] routes"
```

---

## Task 6: Create DashboardPage component and routes

**Files:**
- Create: `apps/web/src/components/pages/DashboardPage.tsx`
- Create: `apps/web/src/app/us/dashboard/page.tsx`
- Create: `apps/web/src/app/in/dashboard/page.tsx`

Read `apps/web/src/app/dashboard/page.tsx` in full, then create `apps/web/src/components/pages/DashboardPage.tsx` with these changes:

- [ ] **Step 1: Copy and modify dashboard/page.tsx**

The new file starts with the full content of `apps/web/src/app/dashboard/page.tsx` with these modifications:

**a) Add market prop** — replace:

```typescript
export default function DashboardPage() {
```

With:

```typescript
import { type Market, MARKET_CONFIG } from "@/lib/marketConfig";

interface Props {
  market: Market;
}

export function DashboardPage({ market }: Props) {
  const config = MARKET_CONFIG[market];
```

**b) Default the market filter to match the prop** — change:

```typescript
const [marketFilter, setMarketFilter] = useState<MarketFilter>("All");
```

To:

```typescript
const [marketFilter, setMarketFilter] = useState<MarketFilter>(market);
```

(Dashboard opens pre-filtered to the correct market.)

**c) Fix the "New Strategy" link** — change `href="/"` to:

```tsx
href={`/${market.toLowerCase()}`}
```

**d) Fix strategy detail links** — change:

```tsx
href={`/strategy/${s.id as string}`}
```

To:

```tsx
href={`/${market.toLowerCase()}/strategy/${s.id as string}`}
```

**e) Fix the empty state "Generate" link** — change `href="/"` to:

```tsx
href={`/${market.toLowerCase()}`}
```

**f) Add market switcher** — next to the "New Strategy" button in the header, add:

```tsx
<a href="/" className="text-xs text-gray-600 hover:text-gray-400 transition-colors mr-3">
  ← Switch market
</a>
```

- [ ] **Step 2: Create the route wrappers**

```typescript
// apps/web/src/app/us/dashboard/page.tsx
import { DashboardPage } from "@/components/pages/DashboardPage";

export default function USDashboardPage() {
  return <DashboardPage market="US" />;
}
```

```typescript
// apps/web/src/app/in/dashboard/page.tsx
import { DashboardPage } from "@/components/pages/DashboardPage";

export default function INDashboardPage() {
  return <DashboardPage market="IN" />;
}
```

- [ ] **Step 3: Verify**

Navigate to `http://localhost:3000/us/dashboard` — should show US strategies filtered. Navigate to `http://localhost:3000/in/dashboard` — should show India strategies filtered.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/pages/DashboardPage.tsx apps/web/src/app/us/dashboard apps/web/src/app/in/dashboard
git commit -m "feat: extract DashboardPage component and add /us/dashboard and /in/dashboard routes"
```

---

## Task 7: Create landing page at /

**Files:**
- Modify: `apps/web/src/app/page.tsx` (replace with landing page)

- [ ] **Step 1: Read the current page.tsx to prepare for replacement**

Read `apps/web/src/app/page.tsx`. We are replacing the entire contents.

- [ ] **Step 2: Write the new landing page**

Replace the entire contents of `apps/web/src/app/page.tsx` with:

```typescript
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MARKET_CONFIG, type Market } from "@/lib/marketConfig";

const MARKETS: Market[] = ["US", "IN"];
const STORAGE_KEY = "sf_market";

const EXCHANGE_LABELS: Record<Market, string> = {
  US: "NYSE · NASDAQ",
  IN: "NSE · BSE",
};

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Market | null;
    if (saved && (saved === "US" || saved === "IN")) {
      const timer = setTimeout(() => {
        router.push(`/${saved.toLowerCase()}`);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [router]);

  function handleSelect(market: Market) {
    localStorage.setItem(STORAGE_KEY, market);
    router.push(`/${market.toLowerCase()}`);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-gray-100 sm:text-4xl">
          Strategy<span className="text-blue-600">Forge</span>
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Choose your market to begin
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        {MARKETS.map((m) => {
          const cfg = MARKET_CONFIG[m];
          return (
            <button
              key={m}
              onClick={() => handleSelect(m)}
              className="flex-1 rounded-2xl border border-white/[0.06] bg-[#111118] p-6 text-center hover:border-blue-500/40 hover:bg-white/[0.03] transition-all"
            >
              <p className="text-4xl mb-3">{cfg.flag}</p>
              <p className="text-base font-semibold text-gray-100">{cfg.label} Stocks</p>
              <p className="text-xs text-gray-500 mt-1">{EXCHANGE_LABELS[m]}</p>
              <p className="text-[10px] text-gray-600 mt-2">{cfg.brokerContext}</p>
            </button>
          );
        })}
      </div>

      <p className="mt-10 text-[10px] text-gray-600">
        For educational purposes only. Not investment advice.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verify landing page renders**

Navigate to `http://localhost:3000/`. Should show two market cards. Clicking US should navigate to `/us`. Clicking India should navigate to `/in`. Second visit to `/` should auto-redirect after 1.2 seconds to the last used market.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat: replace / with market selector landing page"
```

---

## Task 8: Redirect legacy routes

**Files:**
- Modify: `apps/web/src/app/dashboard/page.tsx`
- Modify: `apps/web/src/app/strategy/[id]/page.tsx`

These legacy routes stay in place temporarily so bookmarks don't break, but redirect to the US-market versions.

- [ ] **Step 1: Replace legacy dashboard/page.tsx**

Read `apps/web/src/app/dashboard/page.tsx` first, then replace entire contents with:

```typescript
// apps/web/src/app/dashboard/page.tsx
import { redirect } from "next/navigation";

export default function LegacyDashboard() {
  redirect("/us/dashboard");
}
```

- [ ] **Step 2: Replace legacy strategy/[id]/page.tsx**

Read `apps/web/src/app/strategy/[id]/page.tsx` first, then replace entire contents with:

```typescript
// apps/web/src/app/strategy/[id]/page.tsx
import { redirect } from "next/navigation";

export default function LegacyStrategyDetail({ params }: { params: { id: string } }) {
  redirect(`/us/strategy/${params.id}`);
}
```

- [ ] **Step 3: Verify redirects**

Navigate to `http://localhost:3000/dashboard` — should redirect to `/us/dashboard`.
Navigate to `http://localhost:3000/strategy/any-id` — should redirect to `/us/strategy/any-id`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/page.tsx apps/web/src/app/strategy
git commit -m "feat: redirect legacy /dashboard and /strategy/[id] to /us/* equivalents"
```

---

## Task 9: Fix news_fetcher.py — market param ignored in GNews

**Files:**
- Modify: `apps/engine/services/news_fetcher.py`

The `_fetch_gnews` method has `_market` (underscore prefix = param ignored). This means GNews always returns generic business news regardless of market.

- [ ] **Step 1: Read the file to confirm the exact signature**

Read `apps/engine/services/news_fetcher.py` lines 98–130.

- [ ] **Step 2: Fix the underscore prefix and add market-aware query**

Find the `_fetch_gnews` method signature:

```python
def _fetch_gnews(self, _market: str, limit: int) -> tuple[str, list[dict]]:
```

Replace with:

```python
def _fetch_gnews(self, market: str, limit: int) -> tuple[str, list[dict]]:
    api_key = os.getenv("GNEWS_API_KEY")
    if not api_key:
        return "gnews", []

    query = "India stock market NSE Nifty" if market == "IN" else "US stock market S&P500"
    params = urllib.parse.urlencode(
        {
            "q": query,
            "lang": "en",
            "max": limit,
            "apikey": api_key,
        }
    )
    request = urllib.request.Request(
        f"https://gnews.io/api/v4/search?{params}",
        headers={"User-Agent": "StrategyForge/1.0"},
    )
```

Note: switching from `top-headlines` with `category` to `search` with `q` so the query filters by market. The rest of the method body (reading `articles`, building return list) stays unchanged.

- [ ] **Step 3: Verify the engine still starts**

```bash
cd apps/engine && source venv/bin/activate && python -c "from services.news_fetcher import NewsFetcher; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add apps/engine/services/news_fetcher.py
git commit -m "fix: pass market query to GNews so news is actually filtered by market"
```

---

## Task 10: Fix confidence_scorer.py — S&P 500 regime shown for India

**Files:**
- Modify: `apps/engine/services/confidence_scorer.py`

The `score` method fetches the regime using SPY by default and never changes this for India strategies. India strategies should use their primary index ticker (^NSEI).

- [ ] **Step 1: Read the score method to find where regime detection is called**

Read `apps/engine/services/confidence_scorer.py` lines 80–160.

- [ ] **Step 2: Find and update the regime detection call**

Locate the line in `score()` that calls `self.detect_regime(...)`. It will look like:

```python
regime_info = self.detect_regime("SPY")
```

or similar. Replace it with a market-aware call. The `market` field is in `strategy["universe"]["market"]`. The change:

```python
universe = strategy.get("universe", {})
market = str(universe.get("market", "US")).upper()
regime_ticker = "^NSEI" if market == "IN" else "SPY"
regime_info = self.detect_regime(regime_ticker)
```

- [ ] **Step 3: Verify the engine still imports cleanly**

```bash
cd apps/engine && source venv/bin/activate && python -c "from services.confidence_scorer import ConfidenceScorer; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add apps/engine/services/confidence_scorer.py
git commit -m "fix: use ^NSEI for India regime detection in confidence scorer instead of SPY"
```

---

## Task 11: Fix generator.ts — forward commission/slippage from request body

**Files:**
- Modify: `apps/api/src/ai/generator.ts`

The frontend now sends `commission_percent` and `slippage_percent` in preferences. The `generate()` function should apply them to the generated strategy's `backtest_config` instead of relying on whatever the AI produces.

- [ ] **Step 1: Read the generate function**

Read `apps/api/src/ai/generator.ts` lines 540–630 to see where `backtest_config` is fixed up after generation.

- [ ] **Step 2: Apply commission/slippage override after generation**

Find the block that starts with `// Fix backtest_config field names` (around line 547). After the field-name normalization block and before the return, add:

```typescript
// Apply market-correct commission and slippage from frontend config
if (input.preferences?.commission_percent != null) {
  strategy.backtest_config = {
    ...(strategy.backtest_config ?? {}),
    commission_percent: input.preferences.commission_percent as number,
  };
}
if (input.preferences?.slippage_percent != null) {
  strategy.backtest_config = {
    ...(strategy.backtest_config ?? {}),
    slippage_percent: input.preferences.slippage_percent as number,
  };
}
```

Where `input` is the parameter to the `generate()` function. Read the function signature to confirm the parameter name.

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/api && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ai/generator.ts
git commit -m "fix: apply market-correct commission and slippage from frontend config to generated strategy"
```

---

## Task 12: End-to-end verification

- [ ] **Step 1: Start all three services**

```bash
# Terminal 1
npm run dev:api

# Terminal 2
npm run dev:web

# Terminal 3
npm run dev:engine
```

- [ ] **Step 2: Verify the full user journey for US**

1. Navigate to `http://localhost:3000/` — landing page with two market cards
2. Click "US Stocks" — navigates to `/us`
3. Describe a strategy, generate, backtest
4. Check browser network tab: `generateStrategy` call includes `commission_percent: 0.1`
5. View strategy detail at `/us/strategy/<id>`
6. Navigate to `/us/dashboard` — shows US strategies

- [ ] **Step 3: Verify the full user journey for India**

1. Navigate to `http://localhost:3000/` — click "India Stocks" → navigates to `/in`
2. Describe an India strategy (e.g. "Nifty IT momentum"), generate, backtest
3. Check browser network tab: `generateStrategy` call includes `commission_percent: 0.03`
4. Confidence score should NOT show S&P 500 regime (check response JSON)
5. View strategy detail at `/in/strategy/<id>`
6. Navigate to `/in/dashboard` — shows India strategies pre-filtered

- [ ] **Step 4: Verify legacy redirects**

1. Navigate to `http://localhost:3000/dashboard` — should redirect to `/us/dashboard`
2. Navigate to `http://localhost:3000/strategy/any-id` — should redirect to `/us/strategy/any-id`

- [ ] **Step 5: Verify localStorage persistence**

1. Select India on the landing page
2. Navigate back to `http://localhost:3000/`
3. Should auto-redirect to `/in` after ~1 second with "Switch market" link visible

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete US/India market structural separation"
```
