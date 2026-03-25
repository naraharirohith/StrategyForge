import { Router } from "express";

const ENGINE_URL = process.env.ENGINE_URL || "http://localhost:8001";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  try {
    // Check engine health
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const engineRes = await fetch(`${ENGINE_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!engineRes.ok) {
      throw new Error(`Engine returned ${engineRes.status}`);
    }
    const engineHealth = await engineRes.json();
    res.json({
      status: "ok",
      api_version: "0.1.0",
      engine: engineHealth,
      database: "connected",
    });
  } catch (e) {
    res.json({
      status: "degraded",
      api_version: "0.1.0",
      engine: "unreachable",
      database: "connected",
    });
  }
});
