"""
StrategyForge Backtesting Engine

FastAPI service that:
1. Receives a StrategyDefinition JSON
2. Fetches historical OHLCV data via yfinance
3. Runs the backtest using backtesting.py
4. Computes StrategyScore (composite 0-100)
5. Returns BacktestResult JSON

Runs as a separate microservice on port 8001.
The Node.js API gateway calls this service.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Any
from starlette.responses import StreamingResponse
import numpy as np
import json
import time

from services import (
    DataFetcher,
    IndicatorCalculator,
    run_backtest,
    run_backtest_on_df,
    run_backtest_multi,
    run_walk_forward,
    ScoreCalculator,
    ConfidenceScorer,
    MarketSnapshot,
    NewsFetcher,
)
from services.strategy_templates import get_template, get_template_list, customize_template

app = FastAPI(title="StrategyForge Engine", version="0.1.0")


def _prepare_ticker_dfs(
    tickers: list[str],
    timeframe: str,
    indicators: list[dict],
    bt_config: dict,
    force_refresh: bool = False,
) -> tuple:
    """
    Fetch data, compute indicators, and trim warmup for all tickers.

    Returns:
        Tuple of (ticker_dfs: dict[str, DataFrame], errors: list[str]).
        ticker_dfs maps ticker -> ready-to-backtest DataFrame.
    """
    ticker_dfs = {}
    errors = []

    max_warmup = 0
    for ind in indicators:
        p = ind.get("params", {})
        max_warmup = max(
            max_warmup,
            int(p.get("period", 0)),
            int(p.get("slow", 0)),
            int(p.get("k_period", 0)),
        )

    for ticker in tickers:
        try:
            raw = DataFetcher.fetch(
                ticker, timeframe,
                start_date=bt_config.get("start_date"),
                end_date=bt_config.get("end_date"),
                force_refresh=force_refresh,
            )
            if len(raw) < 50:
                errors.append(f"{ticker}: only {len(raw)} bars fetched")
                continue

            computed = IndicatorCalculator.compute(raw.copy(), indicators)
            trimmed = computed.iloc[max_warmup + 5:].ffill().dropna(
                subset=["Open", "High", "Low", "Close", "Volume"]
            )
            if len(trimmed) < 30:
                errors.append(f"{ticker}: only {len(trimmed)} bars after warmup ({max_warmup} bars)")
                continue

            ticker_dfs[ticker] = trimmed
        except Exception as e:
            errors.append(f"{ticker}: {e}")
            continue

    return ticker_dfs, errors


def sanitize_numpy(obj):
    """Recursively convert numpy types to native Python types for JSON serialization."""
    if isinstance(obj, dict):
        return {k: sanitize_numpy(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_numpy(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


def format_sse(event: str, data: dict) -> str:
    """Format a dict as an SSE event string."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _compute_backtest_metrics(
    bt_result: dict,
    df,
    strategy: dict,
    initial_capital: float,
    equity_curve_data: list,
    indicators: list,
) -> dict:
    """
    Compute all summary metrics, score, drawdown curve, walk-forward, etc.
    Shared by both /backtest and /backtest/stream endpoints.

    Returns the full result dict ready for JSON serialization.
    """
    import pandas as pd

    trades = bt_result["trades"]
    equity_curve = bt_result["equity_curve"]
    capital = bt_result["capital"]
    universe = strategy.get("universe", {})

    # --- Early return for zero-trade results ---
    if not trades:
        summary = {
            "total_return_percent": 0.0,
            "annualized_return_percent": 0.0,
            "sharpe_ratio": 0.0,
            "sortino_ratio": 0.0,
            "max_drawdown_percent": 0.0,
            "max_drawdown_duration_days": 0,
            "total_trades": 0,
            "winning_trades": 0,
            "losing_trades": 0,
            "win_rate": 0.0,
            "profit_factor": 0.0,
            "avg_win_percent": 0.0,
            "avg_loss_percent": 0.0,
            "avg_holding_bars": 0.0,
            "best_trade_percent": 0.0,
            "worst_trade_percent": 0.0,
            "calmar_ratio": 0.0,
            "volatility_annual": 0.0,
            "benchmark_return_percent": (
                round(
                    ((float(df.iloc[-1]["Close"]) / float(df.iloc[0]["Close"])) - 1) * 100, 2
                )
                if df is not None and len(df) >= 2
                else 0.0
            ),
            "alpha": 0.0,
            "beta": 0.0,
        }
        score = ScoreCalculator.compute(summary)
        return {
            "strategy_id": strategy.get("id", "temp"),
            "run_id": f"bt_{int(time.time())}",
            "run_timestamp": pd.Timestamp.now().isoformat(),
            "summary": summary,
            "score": score,
            "equity_curve": equity_curve,
            "drawdown_curve": [],
            "trades": [],
            "monthly_returns": [],
            "regime_performance": [],
            "walk_forward": None,
            "zero_trades_warning": (
                "No trades fired — entry conditions never triggered on the available data. "
                "Try relaxing entry thresholds, extending the backtest period, or switching to a daily timeframe."
            ),
        }
    # --- End early return ---

    # Summary metrics
    total_return = ((capital - initial_capital) / initial_capital) * 100
    winning = [t for t in trades if t["pnl"] > 0]
    losing = [t for t in trades if t["pnl"] <= 0]
    win_rate = (len(winning) / len(trades) * 100) if trades else 0
    gross_profit = sum(t["pnl"] for t in winning) if winning else 0
    gross_loss = abs(sum(t["pnl"] for t in losing)) if losing else 1
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0

    # Equity curve stats
    eq_values = [e[1] for e in equity_curve]
    returns = np.array([])
    if len(eq_values) > 1:
        returns = np.diff(eq_values) / eq_values[:-1]
        sharpe = (np.mean(returns) / np.std(returns) * np.sqrt(252)) if np.std(returns) > 0 else 0
        peak = np.maximum.accumulate(eq_values)
        drawdown = (np.array(eq_values) - peak) / peak * 100
        max_dd = float(np.min(drawdown))
    else:
        sharpe = 0
        max_dd = 0

    # Annualized return
    trading_days = len(eq_values)
    if trading_days > 1 and total_return > -100:
        total_return_decimal = total_return / 100
        annualized_return = ((1 + total_return_decimal) ** (252 / trading_days) - 1) * 100
    else:
        annualized_return = total_return

    # Sortino ratio
    if len(eq_values) > 1:
        neg_returns = returns[returns < 0]
        if len(neg_returns) > 0:
            downside_std = float(np.std(neg_returns))
            annualized_return_decimal = annualized_return / 100
            sortino = annualized_return_decimal / (downside_std * np.sqrt(252)) if downside_std > 0 else 0
        else:
            sortino = float(sharpe)
    else:
        sortino = 0.0

    # Max drawdown duration
    max_dd_duration = 0
    if len(eq_values) > 1:
        current_dd_start = None
        current_duration = 0
        peak_val_dd = eq_values[0]
        for eq_val in eq_values:
            if eq_val >= peak_val_dd:
                peak_val_dd = eq_val
                if current_dd_start is not None:
                    max_dd_duration = max(max_dd_duration, current_duration)
                current_dd_start = None
                current_duration = 0
            else:
                if current_dd_start is None:
                    current_dd_start = eq_val
                current_duration += 1
        if current_dd_start is not None:
            max_dd_duration = max(max_dd_duration, current_duration)

    # Alpha / Beta
    market = universe.get("market", "US")
    benchmark_ticker = "^NSEI" if market == "IN" else "SPY"
    alpha_val = 0.0
    beta_val = 0.0
    try:
        import yfinance as yf
        bench_data = yf.download(
            benchmark_ticker, period="max", interval="1d",
            progress=False, auto_adjust=True
        )
        if isinstance(bench_data.columns, pd.MultiIndex):
            bench_data.columns = bench_data.columns.get_level_values(0)
        eq_dates = pd.DatetimeIndex([pd.Timestamp(e[0]) for e in equity_curve])
        bench_aligned = bench_data["Close"].reindex(eq_dates, method="ffill").dropna()
        if len(bench_aligned) > 10:
            bench_returns = bench_aligned.pct_change().dropna().values
            strat_eq = np.array([e[1] for e in equity_curve])
            min_len = min(len(bench_returns), len(strat_eq) - 1)
            strat_returns_aligned = np.diff(strat_eq[-min_len - 1:]) / strat_eq[-min_len - 1:-1]
            bench_returns_aligned = bench_returns[-min_len:]
            if len(strat_returns_aligned) > 5 and len(bench_returns_aligned) > 5:
                cov_matrix = np.cov(strat_returns_aligned, bench_returns_aligned)
                bench_var = np.var(bench_returns_aligned)
                beta_val = float(cov_matrix[0, 1] / bench_var) if bench_var > 0 else 0.0
                bench_total_return = float((bench_aligned.iloc[-1] / bench_aligned.iloc[0] - 1) * 100)
                bench_annualized = ((1 + bench_total_return / 100) ** (252 / len(bench_aligned)) - 1) * 100
                alpha_val = annualized_return - beta_val * bench_annualized
    except Exception as e:
        print(f"Alpha/Beta calculation failed: {e}")

    # Monthly returns
    monthly_returns = []
    try:
        eq_series = pd.Series(
            [e[1] for e in equity_curve],
            index=pd.DatetimeIndex([pd.Timestamp(e[0]) for e in equity_curve])
        )
        monthly_eq = eq_series.resample("ME").last().dropna()
        if len(monthly_eq) >= 2:
            for i in range(1, len(monthly_eq)):
                prev_val = float(monthly_eq.iloc[i - 1])
                curr_val = float(monthly_eq.iloc[i])
                month_return = ((curr_val - prev_val) / prev_val * 100) if prev_val != 0 else 0
                monthly_returns.append({
                    "month": str(monthly_eq.index[i])[:7],
                    "return_percent": round(month_return, 2),
                    "equity": round(curr_val, 2),
                })
    except Exception as e:
        print(f"Monthly returns calculation failed: {e}")

    # Regime performance
    regime_performance = []
    try:
        import yfinance as yf
        bench_ticker_regime = "^NSEI" if market == "IN" else "SPY"
        bench_regime_data = yf.download(
            bench_ticker_regime, period="max", interval="1d",
            progress=False, auto_adjust=True
        )
        if isinstance(bench_regime_data.columns, pd.MultiIndex):
            bench_regime_data.columns = bench_regime_data.columns.get_level_values(0)

        if not bench_regime_data.empty and len(bench_regime_data) > 50:
            bench_close = bench_regime_data["Close"]
            bench_sma50 = bench_close.rolling(50).mean()

            regime_trades: dict = {"bull": [], "bear": [], "sideways": []}
            for trade in trades:
                try:
                    entry_ts = pd.Timestamp(trade["entry_date"].split(" ")[0])
                    available = bench_close.index[bench_close.index <= entry_ts]
                    if len(available) == 0:
                        continue
                    ref_date = available[-1]
                    price_at_entry = float(bench_close.loc[ref_date])
                    sma_at_entry = float(bench_sma50.loc[ref_date]) if ref_date in bench_sma50.index else float("nan")
                    if pd.isna(sma_at_entry):
                        continue
                    lookback = bench_close.index[bench_close.index <= ref_date]
                    if len(lookback) >= 21:
                        price_20d_ago = float(bench_close.iloc[bench_close.index.get_loc(ref_date) - 20])
                        ret_20d = (price_at_entry / price_20d_ago - 1) * 100
                    else:
                        ret_20d = 0.0

                    if abs(ret_20d) < 2 and abs(price_at_entry - sma_at_entry) / sma_at_entry < 0.02:
                        regime = "sideways"
                    elif price_at_entry > sma_at_entry:
                        regime = "bull"
                    else:
                        regime = "bear"
                    regime_trades[regime].append(trade["pnl_percent"])
                except Exception:
                    continue

            for regime_name, regime_pnls in regime_trades.items():
                if regime_pnls:
                    regime_performance.append({
                        "regime": regime_name,
                        "trade_count": len(regime_pnls),
                        "return_percent": round(float(np.mean(regime_pnls)), 2),
                        "win_rate": round(sum(1 for p in regime_pnls if p > 0) / len(regime_pnls) * 100, 1),
                    })
    except Exception as e:
        print(f"Regime performance calculation failed: {e}")

    summary = {
        "total_return_percent": round(total_return, 2),
        "annualized_return_percent": round(annualized_return, 2),
        "sharpe_ratio": round(sharpe, 3),
        "sortino_ratio": round(sortino, 3),
        "max_drawdown_percent": round(max_dd, 2),
        "max_drawdown_duration_days": max_dd_duration,
        "total_trades": len(trades),
        "winning_trades": len(winning),
        "losing_trades": len(losing),
        "win_rate": round(win_rate, 1),
        "profit_factor": round(profit_factor, 3),
        "avg_win_percent": round(np.mean([t["pnl_percent"] for t in winning]), 2) if winning else 0,
        "avg_loss_percent": round(np.mean([t["pnl_percent"] for t in losing]), 2) if losing else 0,
        "avg_holding_bars": round(np.mean([t["holding_bars"] for t in trades]), 1) if trades else 0,
        "best_trade_percent": max([t["pnl_percent"] for t in trades], default=0),
        "worst_trade_percent": min([t["pnl_percent"] for t in trades], default=0),
        "calmar_ratio": round(total_return / abs(max_dd), 3) if max_dd != 0 else 0,
        "volatility_annual": round(float(np.std(returns) * np.sqrt(252) * 100), 2) if len(eq_values) > 1 else 0,
        "benchmark_return_percent": round(((float(df.iloc[-1]["Close"]) / float(df.iloc[0]["Close"])) - 1) * 100, 2),
        "alpha": round(alpha_val, 4),
        "beta": round(beta_val, 4),
    }

    # Strategy score
    score_input = {**summary, "monthly_returns": monthly_returns, "regime_performance": regime_performance}
    score = ScoreCalculator.compute(score_input)

    # Drawdown curve
    drawdown_curve = []
    if len(eq_values) > 0:
        peak_val = eq_values[0]
        for idx, (ts, val) in enumerate(equity_curve):
            peak_val = max(peak_val, val)
            dd = ((val - peak_val) / peak_val) * 100 if peak_val > 0 else 0
            drawdown_curve.append([ts, round(dd, 2)])

    # Walk-forward validation
    walk_forward = None
    try:
        walk_forward = run_walk_forward(
            df=df,
            strategy=strategy,
            indicators=indicators,
            run_backtest_fn=run_backtest_on_df,
            score_calculator=ScoreCalculator,
        )
    except Exception as e:
        print(f"Walk-forward validation skipped: {e}")

    result = {
        "strategy_id": strategy.get("id", "temp"),
        "run_id": f"bt_{int(time.time())}",
        "run_timestamp": pd.Timestamp.now().isoformat(),
        "summary": summary,
        "score": score,
        "equity_curve": equity_curve,
        "drawdown_curve": drawdown_curve,
        "trades": trades,
        "monthly_returns": monthly_returns,
        "regime_performance": regime_performance,
        "walk_forward": walk_forward,
    }
    return result


# ============================================================
# Request / Response Models
# ============================================================

class BacktestRequest(BaseModel):
    strategy: dict  # StrategyDefinition JSON
    force_refresh_data: bool = False


class BacktestResponse(BaseModel):
    success: bool
    result: Optional[dict] = None  # BacktestResult JSON
    error: Optional[str] = None
    duration_ms: Optional[int] = None


class ConfidenceRequest(BaseModel):
    strategy: dict
    latest_backtest: dict  # BacktestResult from previous run


class ConfidenceResponse(BaseModel):
    success: bool
    confidence: Optional[dict] = None  # ConfidenceScore JSON
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    engine_version: str
    supported_indicators: list[str]


# ============================================================
# API Routes
# ============================================================

@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        engine_version="0.1.0",
        supported_indicators=IndicatorCalculator.SUPPORTED,
    )


@app.get("/market-snapshot")
async def get_market_snapshot(market: str = "US"):
    """
    Get current market snapshot (indices, VIX, sectors, regime, hot tickers).
    Cached for 6 hours. Used by AI generator for context-aware strategies.
    """
    try:
        snapshot = MarketSnapshot.compute(market)
        return {"success": True, "snapshot": sanitize_numpy(snapshot)}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/market-snapshot/prompt")
async def get_market_prompt(market: str = "US"):
    """
    Get market snapshot formatted as a text block for AI prompt injection.
    """
    try:
        prompt_text = MarketSnapshot.get_prompt_context(market)
        return {"success": True, "prompt_context": prompt_text}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/news")
async def get_news(market: str = "US", limit: int = 10):
    """
    Get recent business headlines for the requested market.
    Falls back across multiple providers and never raises.
    """
    fetcher = NewsFetcher()
    normalized_market = str(market or "US").upper()
    headlines = fetcher.fetch_headlines(normalized_market, limit)
    return {
        "headlines": headlines,
        "source": fetcher.last_source,
        "market": normalized_market,
    }


@app.post("/confidence", response_model=ConfidenceResponse)
async def get_confidence(req: ConfidenceRequest):
    """
    Compute a live confidence score for a strategy given current market conditions.
    Requires the strategy definition and the latest backtest result.
    """
    try:
        confidence = ConfidenceScorer.compute(req.strategy, req.latest_backtest)
        return ConfidenceResponse(success=True, confidence=confidence)
    except Exception as e:
        return ConfidenceResponse(success=False, error=str(e))


@app.post("/backtest", response_model=BacktestResponse)
async def run_backtest_endpoint(req: BacktestRequest):
    """
    Run a backtest for a given strategy definition.
    Supports single-ticker and multi-ticker strategies.
    This is the main endpoint called by the Node.js API gateway.
    """
    import pandas as pd

    start_time = time.time()

    try:
        strategy = req.strategy
        universe = strategy.get("universe", {})
        tickers = universe.get("tickers", [])
        timeframe = strategy.get("timeframe", "1d")
        bt_config = strategy.get("backtest_config", {})
        initial_capital = bt_config.get("initial_capital", 100000)
        commission = bt_config.get("commission_percent", 0.1) / 100
        slippage = bt_config.get("slippage_percent", 0.05) / 100
        indicators = strategy.get("indicators", [])

        if not tickers:
            raise ValueError("No tickers specified in strategy universe")

        ticker_dfs, errors = _prepare_ticker_dfs(
            tickers, timeframe, indicators, bt_config,
            force_refresh=req.force_refresh_data,
        )

        if not ticker_dfs:
            last_error = errors[-1] if errors else "Unknown error"
            raise ValueError(f"No ticker had sufficient data. Last error: {last_error}")

        # Multi-ticker or single-ticker backtest
        if len(ticker_dfs) > 1:
            bt_result = run_backtest_multi(
                ticker_dfs=ticker_dfs, strategy=strategy,
                initial_capital=initial_capital, commission=commission,
                slippage=slippage, indicators=indicators,
            )
            # Use the first ticker's df for metrics (benchmark comparison etc.)
            primary_ticker = list(ticker_dfs.keys())[0]
            df = ticker_dfs[primary_ticker]
        else:
            primary_ticker = list(ticker_dfs.keys())[0]
            df = ticker_dfs[primary_ticker]
            bt_result = run_backtest(
                df=df, strategy=strategy, primary_ticker=primary_ticker,
                initial_capital=initial_capital, commission=commission,
                slippage=slippage, indicators=indicators,
            )

        result = _compute_backtest_metrics(
            bt_result=bt_result, df=df, strategy=strategy,
            initial_capital=initial_capital,
            equity_curve_data=bt_result["equity_curve"],
            indicators=indicators,
        )

        # Add multi-ticker metadata if applicable
        if len(ticker_dfs) > 1:
            result["multi_ticker"] = {
                "tickers_requested": tickers,
                "tickers_used": list(ticker_dfs.keys()),
                "tickers_failed": [e for e in errors],
                "per_ticker_trades": bt_result.get("per_ticker_trades", {}),
            }

        duration_ms = int((time.time() - start_time) * 1000)
        return BacktestResponse(success=True, result=sanitize_numpy(result), duration_ms=duration_ms)

    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        return BacktestResponse(success=False, error=str(e), duration_ms=duration_ms)


@app.post("/backtest/stream")
async def run_backtest_stream(req: BacktestRequest):
    """
    Streaming backtest endpoint that emits SSE progress events.
    Supports single-ticker and multi-ticker strategies.
    """

    def generate():
        import pandas as pd

        start_time = time.time()
        try:
            strategy = req.strategy
            universe = strategy.get("universe", {})
            tickers = universe.get("tickers", [])
            timeframe = strategy.get("timeframe", "1d")
            bt_config = strategy.get("backtest_config", {})
            initial_capital = bt_config.get("initial_capital", 100000)
            commission = bt_config.get("commission_percent", 0.1) / 100
            slippage = bt_config.get("slippage_percent", 0.05) / 100
            indicators = strategy.get("indicators", [])

            if not tickers:
                yield format_sse("error", {"error": "No tickers specified"})
                return

            # Stage 1: Fetch data
            ticker_label = f"{len(tickers)} tickers" if len(tickers) > 1 else tickers[0]
            yield format_sse("progress", {
                "stage": "fetching",
                "message": f"Fetching data for {ticker_label}...",
                "percent": 10,
            })

            # Stage 2: Compute indicators
            yield format_sse("progress", {
                "stage": "indicators",
                "message": f"Computing {len(indicators)} indicators...",
                "percent": 30,
            })

            ticker_dfs, errors = _prepare_ticker_dfs(
                tickers, timeframe, indicators, bt_config,
                force_refresh=req.force_refresh_data,
            )

            if not ticker_dfs:
                last_error = errors[-1] if errors else "Unknown error"
                yield format_sse("error", {"error": f"No ticker had sufficient data. Last error: {last_error}"})
                return

            # Stage 3: Run backtest
            total_bars = sum(len(df) for df in ticker_dfs.values())
            yield format_sse("progress", {
                "stage": "backtesting",
                "message": f"Running backtest ({len(ticker_dfs)} tickers, {total_bars} total bars)...",
                "percent": 50,
            })

            if len(ticker_dfs) > 1:
                bt_result = run_backtest_multi(
                    ticker_dfs=ticker_dfs, strategy=strategy,
                    initial_capital=initial_capital, commission=commission,
                    slippage=slippage, indicators=indicators,
                )
                primary_ticker = list(ticker_dfs.keys())[0]
                df = ticker_dfs[primary_ticker]
            else:
                primary_ticker = list(ticker_dfs.keys())[0]
                df = ticker_dfs[primary_ticker]
                bt_result = run_backtest(
                    df=df, strategy=strategy, primary_ticker=primary_ticker,
                    initial_capital=initial_capital, commission=commission,
                    slippage=slippage, indicators=indicators,
                )

            # Stage 4: Compute scoring metrics
            yield format_sse("progress", {
                "stage": "scoring",
                "message": "Computing strategy score...",
                "percent": 75,
            })

            # Stage 5: Walk-forward
            yield format_sse("progress", {
                "stage": "walk_forward",
                "message": "Running walk-forward validation...",
                "percent": 90,
            })

            result = _compute_backtest_metrics(
                bt_result=bt_result, df=df, strategy=strategy,
                initial_capital=initial_capital,
                equity_curve_data=bt_result["equity_curve"],
                indicators=indicators,
            )

            if len(ticker_dfs) > 1:
                result["multi_ticker"] = {
                    "tickers_requested": tickers,
                    "tickers_used": list(ticker_dfs.keys()),
                    "tickers_failed": [e for e in errors],
                    "per_ticker_trades": bt_result.get("per_ticker_trades", {}),
                }

            duration_ms = int((time.time() - start_time) * 1000)
            result["duration_ms"] = duration_ms

            yield format_sse("result", sanitize_numpy(result))

        except Exception as e:
            yield format_sse("error", {"error": str(e)})

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/cache/clear")
async def clear_data_cache():
    """Clear all cached OHLCV data files."""
    from services.cache import clear_cache
    count = clear_cache()
    return {"success": True, "files_cleared": count}


# ============================================================
# Strategy Templates (Phase 3)
# ============================================================

@app.get("/templates")
async def list_templates():
    """List all available strategy templates with metadata."""
    return {"success": True, "templates": get_template_list()}


@app.get("/templates/{template_id}")
async def get_template_endpoint(template_id: str):
    """Get a full strategy template by ID."""
    template = get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    return {"success": True, "template": template}


class CustomizeTemplateRequest(BaseModel):
    template_id: str
    market: Optional[str] = None
    capital: Optional[float] = None
    currency: Optional[str] = None
    tickers: Optional[list[str]] = None


@app.post("/templates/customize")
async def customize_template_endpoint(req: CustomizeTemplateRequest):
    """Get a template customized with user preferences."""
    result = customize_template(
        template_id=req.template_id,
        market=req.market,
        capital=req.capital,
        currency=req.currency,
        tickers=req.tickers,
    )
    if not result:
        raise HTTPException(status_code=404, detail=f"Template '{req.template_id}' not found")
    return {"success": True, "strategy": result}


# ============================================================
# Market Intelligence (Phase 2)
# ============================================================

@app.get("/market-snapshot")
async def market_snapshot(market: str = "US"):
    """Get current market snapshot (indices, VIX, sectors, regime)."""
    try:
        snapshot = MarketSnapshot.compute(market)
        return {"success": True, "snapshot": snapshot}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/market-snapshot/prompt")
async def market_snapshot_prompt(market: str = "US"):
    """Get market snapshot formatted as text for AI prompt injection."""
    try:
        text = MarketSnapshot.get_prompt_context(market)
        return {"success": True, "prompt_context": text}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/news")
async def news_headlines(market: str = "US", limit: int = 5):
    """Get recent financial news headlines."""
    try:
        headlines = NewsFetcher.fetch_headlines(market, limit)
        return {"success": True, "headlines": headlines}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============================================================
# Run
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
