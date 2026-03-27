import "dotenv/config";
import express from "express";
import cors from "cors";
import { ensureGuestUser } from "./lib/prisma.js";
import { healthRouter } from "./routes/health.js";
import { strategiesRouter } from "./routes/strategies.js";
import { marketplaceRouter } from "./routes/marketplace.js";
import { marketRouter } from "./routes/market.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ============================================================
// Routes
// ============================================================

app.use("/api", healthRouter);
app.use("/api", strategiesRouter);
app.use("/api", marketplaceRouter);
app.use("/api", marketRouter);

// ============================================================
// Error handling
// ============================================================

app.use(errorHandler);

// ============================================================
// Start
// ============================================================

ensureGuestUser()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`StrategyForge API running on port ${PORT}`);
      console.log(`Engine URL: ${process.env.ENGINE_URL || "http://localhost:8001"}`);
    });
  })
  .catch((e) => {
    console.error("Failed to initialize guest user:", e);
    process.exit(1);
  });
