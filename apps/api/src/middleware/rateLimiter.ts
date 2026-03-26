import { Request, Response, NextFunction } from "express";

interface RateLimitConfig {
  windowMs: number;    // time window in ms
  max: number;         // max requests per window
  message?: string;
}

const stores = new Map<string, Map<string, { count: number; resetAt: number }>>();

export function rateLimit(config: RateLimitConfig) {
  const { windowMs, max, message = "Too many requests, please try again later" } = config;
  const storeKey = `${windowMs}-${max}`;

  if (!stores.has(storeKey)) {
    stores.set(storeKey, new Map());
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const store = stores.get(storeKey)!;
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    const record = store.get(key);
    if (!record || now > record.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    record.count++;
    if (record.count > max) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter,
      });
    }

    next();
  };
}

// Preconfigured limiters
export const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10,
  message: "Generation limit reached (10/hour). Please try again later.",
});

export const backtestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 20,
  message: "Backtest limit reached (20/hour). Please try again later.",
});

export const confidenceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 30,
  message: "Confidence scoring limit reached (30/hour). Please try again later.",
});

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const store of stores.values()) {
    for (const [key, record] of store.entries()) {
      if (now > record.resetAt) store.delete(key);
    }
  }
}, 10 * 60 * 1000);
