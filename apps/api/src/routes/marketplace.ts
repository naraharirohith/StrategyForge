import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const marketplaceRouter = Router();

// ============================================================
// Marketplace — Browse strategies
// ============================================================

marketplaceRouter.get("/marketplace", async (req, res) => {
  try {
    const {
      market,
      style,
      risk_level,
      min_score,
      sort_by = "score",
      page = "1",
      limit = "20",
    } = req.query;

    const where: Prisma.StrategyWhereInput = { isPublished: true };
    if (market) where.market = market as "US" | "IN";
    if (style) where.style = style as Prisma.EnumStrategyStyleFilter<"Strategy">;
    if (risk_level) where.riskLevel = risk_level as Prisma.EnumRiskLevelFilter<"Strategy">;
    if (min_score) where.score = { gte: parseFloat(min_score as string) };

    const orderBy: Prisma.StrategyOrderByWithRelationInput = {};
    if (sort_by === "score") orderBy.score = "desc";
    else if (sort_by === "return") orderBy.totalReturn = "desc";
    else if (sort_by === "newest") orderBy.publishedAt = "desc";

    const take = parseInt(limit as string);
    const pageNum = parseInt(page as string);

    const strategies = await prisma.strategy.findMany({
      where,
      orderBy,
      take,
      skip: (pageNum - 1) * take,
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        _count: { select: { subscriptions: true } },
      },
    });

    const total = await prisma.strategy.count({ where });

    res.json({
      strategies,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error("Marketplace error:", e);
    res.status(500).json({ error: errorMsg });
  }
});
