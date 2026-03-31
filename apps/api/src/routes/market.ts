import { Router } from "express";

const ENGINE_URL = process.env.ENGINE_URL || "http://localhost:8001";

export const marketRouter = Router();

/**
 * GET /api/market-snapshot?market=US
 * Proxy to Python engine's /market-snapshot endpoint.
 * Returns current market state (indices, VIX, sectors, regime, hot tickers).
 */
marketRouter.get("/market-snapshot", async (req, res) => {
  try {
    const market = (req.query.market as string) || "US";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const engineRes = await fetch(
      `${ENGINE_URL}/market-snapshot?market=${encodeURIComponent(market)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    const data = await engineRes.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e instanceof Error ? e.message : "Failed to fetch market snapshot",
    });
  }
});

/**
 * GET /api/market/screener?market=US&sector=technology&limit=6
 * Proxy to Python engine's /screener endpoint.
 * Returns top performing stocks in a sector with price, 1-month return, and trend.
 */
marketRouter.get("/market/screener", async (req, res) => {
  const { market = "US", sector = "technology", limit = "6" } = req.query as Record<string, string>;
  try {
    const response = await fetch(
      `${ENGINE_URL}/screener?market=${market}&sector=${sector}&limit=${limit}`
    );
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.json({ success: false, stocks: [], error: String(e) });
  }
});

/**
 * GET /api/market/screener/tickers?tickers=AAPL,MSFT&market=US
 * Proxy to Python engine's /screener/tickers endpoint.
 * Returns screener metrics for specific tickers.
 */
marketRouter.get("/market/screener/tickers", async (req, res) => {
  const { tickers = "", market = "US" } = req.query as Record<string, string>;
  try {
    const response = await fetch(
      `${ENGINE_URL}/screener/tickers?tickers=${encodeURIComponent(tickers)}&market=${encodeURIComponent(market)}`
    );
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.json({ success: false, stocks: [], error: String(e) });
  }
});

/**
 * GET /api/market/news?market=US&limit=8
 * Proxy to Python engine's /news endpoint.
 */
marketRouter.get("/market/news", async (req, res) => {
  const { market = "US", limit = "8" } = req.query as Record<string, string>;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(
      `${ENGINE_URL}/news?market=${encodeURIComponent(market)}&limit=${encodeURIComponent(limit)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.json({ success: false, headlines: [], error: String(e) });
  }
});

/**
 * GET /api/market-snapshot/prompt?market=US
 * Returns market snapshot formatted as text for AI prompt injection.
 */
marketRouter.get("/market-snapshot/prompt", async (req, res) => {
  try {
    const market = (req.query.market as string) || "US";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const engineRes = await fetch(
      `${ENGINE_URL}/market-snapshot/prompt?market=${encodeURIComponent(market)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    const data = await engineRes.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e instanceof Error ? e.message : "Failed to fetch market prompt",
    });
  }
});
