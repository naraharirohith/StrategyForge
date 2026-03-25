"""
Walk-forward validation for strategy backtesting.

Splits historical data into in-sample (first 70%) and out-of-sample (last 30%),
runs the backtest on each segment independently, and compares scores to assess
overfitting risk.

This is a simplified single-split walk-forward. A full rolling walk-forward
with multiple windows can be added later.
"""

import pandas as pd
import numpy as np
from typing import Optional


def run_walk_forward(
    df: pd.DataFrame,
    strategy: dict,
    indicators: list,
    run_backtest_fn,
    score_calculator,
    split_ratio: float = 0.7,
) -> Optional[dict]:
    """
    Run walk-forward validation on a prepared DataFrame.

    Args:
        df: OHLCV DataFrame with indicators already computed and warmup trimmed.
        strategy: The strategy definition dict.
        indicators: List of indicator configs.
        run_backtest_fn: A callable that runs a backtest on a DataFrame slice
                         and returns (trades, equity_curve, capital).
        score_calculator: ScoreCalculator class with .compute() method.
        split_ratio: Fraction of data for in-sample (default 0.7).

    Returns:
        Walk-forward result dict or None if insufficient data.
    """
    if len(df) < 100:
        return None  # Need enough data for meaningful split

    split_idx = int(len(df) * split_ratio)

    if split_idx < 50 or (len(df) - split_idx) < 30:
        return None  # Each segment needs minimum bars

    is_df = df.iloc[:split_idx].copy()
    oos_df = df.iloc[split_idx:].copy()

    try:
        # Run backtest on in-sample
        is_trades, is_equity, is_capital = run_backtest_fn(is_df, strategy)
        is_metrics = _compute_metrics(is_trades, is_equity, is_capital, strategy)
        is_score = score_calculator.compute(is_metrics)

        # Run backtest on out-of-sample
        oos_trades, oos_equity, oos_capital = run_backtest_fn(oos_df, strategy)
        oos_metrics = _compute_metrics(oos_trades, oos_equity, oos_capital, strategy)
        oos_score = score_calculator.compute(oos_metrics)

        is_overall = is_score["overall"]
        oos_overall = oos_score["overall"]

        # Degradation = how much worse OOS is vs IS
        if is_overall > 0:
            degradation = ((is_overall - oos_overall) / is_overall) * 100
        else:
            degradation = 0

        # Classify overfitting risk
        if degradation <= 15:
            risk = "low"
        elif degradation <= 35:
            risk = "medium"
        else:
            risk = "high"

        return {
            "in_sample_score": round(is_overall, 1),
            "out_of_sample_score": round(oos_overall, 1),
            "degradation_percent": round(degradation, 1),
            "overfitting_risk": risk,
        }
    except Exception as e:
        print(f"Walk-forward validation failed: {e}")
        return None


def _compute_metrics(trades: list, equity_curve: list, final_capital: float, strategy: dict) -> dict:
    """Compute basic metrics from backtest output for scoring."""
    initial_capital = strategy.get("backtest_config", {}).get("initial_capital", 100000)

    if not trades:
        return {
            "sharpe_ratio": 0,
            "max_drawdown_percent": 0,
            "win_rate": 0,
            "profit_factor": 0,
            "monthly_returns": [],
            "regime_performance": [],
        }

    winning = [t for t in trades if t["pnl"] > 0]
    losing = [t for t in trades if t["pnl"] <= 0]
    win_rate = (len(winning) / len(trades) * 100) if trades else 0
    gross_profit = sum(t["pnl"] for t in winning) if winning else 0
    gross_loss = abs(sum(t["pnl"] for t in losing)) if losing else 1
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0

    eq_values = [e[1] for e in equity_curve] if equity_curve else [initial_capital]
    if len(eq_values) > 1:
        returns = np.diff(eq_values) / np.array(eq_values[:-1])
        sharpe = (np.mean(returns) / np.std(returns) * np.sqrt(252)) if np.std(returns) > 0 else 0
        peak = np.maximum.accumulate(eq_values)
        drawdown = (np.array(eq_values) - peak) / peak * 100
        max_dd = float(np.min(drawdown))
    else:
        sharpe = 0
        max_dd = 0

    return {
        "sharpe_ratio": float(sharpe),
        "max_drawdown_percent": max_dd,
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "monthly_returns": [],  # simplified -- skip monthly for WF
        "regime_performance": [],  # simplified -- skip regime for WF
    }
