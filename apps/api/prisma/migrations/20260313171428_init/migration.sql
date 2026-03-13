-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "Market" AS ENUM ('US', 'IN');

-- CreateEnum
CREATE TYPE "StrategyStyle" AS ENUM ('momentum', 'mean_reversion', 'swing', 'positional', 'intraday', 'portfolio', 'hybrid');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('conservative', 'moderate', 'aggressive');

-- CreateEnum
CREATE TYPE "BacktestStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SubStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategies" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "market" "Market" NOT NULL,
    "style" "StrategyStyle" NOT NULL,
    "risk_level" "RiskLevel" NOT NULL,
    "timeframe" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "price_monthly" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "score" DOUBLE PRECISION,
    "grade" TEXT,
    "sharpe_ratio" DOUBLE PRECISION,
    "max_drawdown" DOUBLE PRECISION,
    "total_return" DOUBLE PRECISION,
    "confidence_score" DOUBLE PRECISION,
    "confidence_data" JSONB,
    "confidence_updated_at" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backtest_runs" (
    "id" TEXT NOT NULL,
    "strategy_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "BacktestStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "total_return" DOUBLE PRECISION,
    "sharpe_ratio" DOUBLE PRECISION,
    "max_drawdown" DOUBLE PRECISION,
    "win_rate" DOUBLE PRECISION,
    "profit_factor" DOUBLE PRECISION,
    "total_trades" INTEGER,
    "score" DOUBLE PRECISION,
    "grade" TEXT,
    "overfitting_risk" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "error_msg" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backtest_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ohlcv_cache" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ohlcv_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "subscriber_id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "strategy_id" TEXT NOT NULL,
    "status" "SubStatus" NOT NULL DEFAULT 'ACTIVE',
    "price_monthly" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "platform_fee" DOUBLE PRECISION NOT NULL,
    "creator_payout" DOUBLE PRECISION NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "user_input" TEXT NOT NULL,
    "prompt_hash" TEXT NOT NULL,
    "response_raw" TEXT,
    "success" BOOLEAN NOT NULL,
    "error_msg" TEXT,
    "latency_ms" INTEGER,
    "tokens_used" INTEGER,
    "strategy_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "strategies_market_is_published_idx" ON "strategies"("market", "is_published");

-- CreateIndex
CREATE INDEX "strategies_score_idx" ON "strategies"("score" DESC);

-- CreateIndex
CREATE INDEX "strategies_user_id_idx" ON "strategies"("user_id");

-- CreateIndex
CREATE INDEX "backtest_runs_strategy_id_idx" ON "backtest_runs"("strategy_id");

-- CreateIndex
CREATE INDEX "backtest_runs_user_id_idx" ON "backtest_runs"("user_id");

-- CreateIndex
CREATE INDEX "ohlcv_cache_ticker_timeframe_date_idx" ON "ohlcv_cache"("ticker", "timeframe", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ohlcv_cache_ticker_timeframe_date_key" ON "ohlcv_cache"("ticker", "timeframe", "date");

-- CreateIndex
CREATE INDEX "subscriptions_subscriber_id_idx" ON "subscriptions"("subscriber_id");

-- CreateIndex
CREATE INDEX "subscriptions_creator_id_idx" ON "subscriptions"("creator_id");

-- CreateIndex
CREATE INDEX "subscriptions_strategy_id_idx" ON "subscriptions"("strategy_id");

-- CreateIndex
CREATE INDEX "generation_logs_user_id_idx" ON "generation_logs"("user_id");

-- AddForeignKey
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backtest_runs" ADD CONSTRAINT "backtest_runs_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backtest_runs" ADD CONSTRAINT "backtest_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
