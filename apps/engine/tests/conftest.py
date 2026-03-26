"""
Shared pytest fixtures for the engine test suite.
"""

import sys
import os
import pytest
import pandas as pd
import numpy as np

# Make sure the engine module is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


@pytest.fixture
def synthetic_ohlcv():
    """
    500-bar synthetic OHLCV DataFrame with a gentle uptrend.
    Prices start at 100 and drift upward with added noise.
    """
    np.random.seed(42)
    n = 500
    dates = pd.date_range("2021-01-01", periods=n, freq="B")

    # Trending price series
    drift = 0.0005
    vol = 0.015
    log_returns = np.random.normal(drift, vol, n)
    close = 100.0 * np.exp(np.cumsum(log_returns))

    high = close * (1 + np.abs(np.random.normal(0, 0.005, n)))
    low = close * (1 - np.abs(np.random.normal(0, 0.005, n)))
    open_ = close * (1 + np.random.normal(0, 0.003, n))
    volume = np.random.randint(1_000_000, 5_000_000, n).astype(float)

    df = pd.DataFrame(
        {
            "Open": open_,
            "High": high,
            "Low": low,
            "Close": close,
            "Volume": volume,
        },
        index=dates,
    )
    return df


@pytest.fixture
def golden_cross_strategy():
    """
    A valid StrategyDefinition dict: AAPL EMA50/EMA200 golden cross.
    Mirrors the CLAUDE.md test strategy.
    """
    return {
        "schema_version": "1.0.0",
        "name": "Golden Cross",
        "description": "EMA 50/200 golden cross momentum strategy",
        "style": "momentum",
        "risk_level": "moderate",
        "universe": {
            "market": "US",
            "asset_class": "equity",
            "tickers": ["AAPL"],
        },
        "timeframe": "1d",
        "indicators": [
            {"id": "ema_50", "type": "EMA", "params": {"period": 50}},
            {"id": "ema_200", "type": "EMA", "params": {"period": 200}},
            {"id": "rsi_14", "type": "RSI", "params": {"period": 14}},
        ],
        "entry_rules": [
            {
                "id": "e1",
                "name": "Golden Cross",
                "side": "long",
                "conditions": {
                    "logic": "AND",
                    "conditions": [
                        {
                            "id": "c1",
                            "left": {"type": "indicator", "indicator_id": "ema_50"},
                            "operator": "crosses_above",
                            "right": {"type": "indicator", "indicator_id": "ema_200"},
                        },
                        {
                            "id": "c2",
                            "left": {"type": "indicator", "indicator_id": "rsi_14"},
                            "operator": "lt",
                            "right": {"type": "constant", "value": 60},
                        },
                    ],
                },
                "position_sizing": {"method": "percent_of_portfolio", "percent": 20},
            }
        ],
        "exit_rules": [
            {"id": "x1", "name": "Stop Loss", "type": "stop_loss", "value": 5, "priority": 1},
            {"id": "x2", "name": "Take Profit", "type": "take_profit", "value": 15, "priority": 2},
        ],
        "risk_management": {
            "max_portfolio_drawdown_percent": 15,
            "max_position_count": 5,
        },
        "backtest_config": {
            "initial_capital": 100000,
            "currency": "USD",
            "commission_percent": 0.1,
            "slippage_percent": 0.05,
        },
    }


@pytest.fixture
def rsi_mean_reversion_strategy():
    """
    A valid StrategyDefinition dict: RSI mean-reversion on SPY.
    """
    return {
        "schema_version": "1.0.0",
        "name": "RSI Mean Reversion",
        "description": "Buy oversold RSI dips on SPY",
        "style": "mean_reversion",
        "risk_level": "conservative",
        "universe": {
            "market": "US",
            "asset_class": "equity",
            "tickers": ["SPY"],
        },
        "timeframe": "1d",
        "indicators": [
            {"id": "rsi_14", "type": "RSI", "params": {"period": 14}},
            {"id": "sma_50", "type": "SMA", "params": {"period": 50}},
        ],
        "entry_rules": [
            {
                "id": "e1",
                "name": "RSI Oversold Entry",
                "side": "long",
                "conditions": {
                    "logic": "AND",
                    "conditions": [
                        {
                            "id": "c1",
                            "left": {"type": "indicator", "indicator_id": "rsi_14"},
                            "operator": "lt",
                            "right": {"type": "constant", "value": 30},
                        },
                        {
                            "id": "c2",
                            "left": {"type": "price", "field": "close"},
                            "operator": "gt",
                            "right": {"type": "indicator", "indicator_id": "sma_50"},
                        },
                    ],
                },
                "position_sizing": {"method": "percent_of_portfolio", "percent": 15},
            }
        ],
        "exit_rules": [
            {"id": "x1", "name": "Stop Loss", "type": "stop_loss", "value": 3, "priority": 1},
            {"id": "x2", "name": "RSI Overbought Exit", "type": "take_profit", "value": 8, "priority": 2},
        ],
        "risk_management": {
            "max_portfolio_drawdown_percent": 10,
            "max_position_count": 3,
        },
        "backtest_config": {
            "initial_capital": 50000,
            "currency": "USD",
            "commission_percent": 0.05,
            "slippage_percent": 0.02,
        },
    }
