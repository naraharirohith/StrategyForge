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
