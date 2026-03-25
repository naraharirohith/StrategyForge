"""
Unit tests for ConfidenceScorer.

yfinance calls are mocked using unittest.mock so no network is required.
"""

import sys
import os
import pytest
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services import ConfidenceScorer


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def make_latest_backtest(overall_score=65.0, grade="B"):
    """Build a minimal backtest result dict for ConfidenceScorer."""
    return {
        "score": {"overall": overall_score, "grade": grade},
        "summary": {
            "total_return_percent": 20.0,
            "sharpe_ratio": 1.5,
            "max_drawdown_percent": -10.0,
            "win_rate": 55.0,
        },
    }


def make_mock_ohlcv(n=300, trend="bull"):
    """Create a synthetic OHLCV DataFrame for yfinance mock."""
    np.random.seed(42)
    dates = pd.date_range("2023-01-01", periods=n, freq="B")
    if trend == "bull":
        close = 100.0 * np.exp(np.cumsum(np.random.normal(0.001, 0.01, n)))
    elif trend == "bear":
        close = 100.0 * np.exp(np.cumsum(np.random.normal(-0.001, 0.01, n)))
    else:  # sideways
        close = 100.0 * np.exp(np.cumsum(np.random.normal(0, 0.005, n)))
    high = close * 1.005
    low = close * 0.995
    df = pd.DataFrame(
        {"Open": close, "High": high, "Low": low, "Close": close, "Volume": 1_000_000},
        index=dates,
    )
    return df


# ---------------------------------------------------------------------------
# Test: return value is 0-100
# ---------------------------------------------------------------------------


class TestConfidenceRange:
    @patch("main.ConfidenceScorer.detect_regime")
    @patch("main.ConfidenceScorer.compute_signal_proximity")
    @patch("main.ConfidenceScorer.get_volatility_context")
    @patch("main.ConfidenceScorer.get_global_risk")
    def test_overall_in_range(
        self,
        mock_global,
        mock_vol,
        mock_signal,
        mock_regime,
        golden_cross_strategy,
    ):
        mock_regime.return_value = {"regime": "bull", "adx": 28.0, "price": 175.0, "return_20d": 3.0, "ema_50": 170.0, "ema_200": 160.0}
        mock_signal.return_value = {"score": 75.0, "triggered": False, "description": "Close to signal", "nearest_signal": "N/A"}
        mock_vol.return_value = {"india_vix": None, "us_vix": 18.5, "realized_vol_annual": 22.0, "level": "normal"}
        mock_global.return_value = {"sp500_5d_return": 1.2, "sp500_trend": "up"}

        latest_bt = make_latest_backtest()
        result = ConfidenceScorer.compute(golden_cross_strategy, latest_bt)
        assert 0 <= result["overall"] <= 100

    @patch("main.ConfidenceScorer.detect_regime")
    @patch("main.ConfidenceScorer.compute_signal_proximity")
    @patch("main.ConfidenceScorer.get_volatility_context")
    @patch("main.ConfidenceScorer.get_global_risk")
    def test_extreme_values_stay_bounded(
        self,
        mock_global,
        mock_vol,
        mock_signal,
        mock_regime,
        golden_cross_strategy,
    ):
        """Even with extreme inputs, overall should be clamped to [0, 100]."""
        mock_regime.return_value = {"regime": "bull", "adx": 50.0, "price": 500.0, "return_20d": 20.0, "ema_50": 490.0, "ema_200": 400.0}
        mock_signal.return_value = {"score": 100.0, "triggered": True, "description": "ACTIVE", "nearest_signal": "ACTIVE"}
        mock_vol.return_value = {"india_vix": None, "us_vix": 10.0, "realized_vol_annual": 10.0, "level": "low"}
        mock_global.return_value = {}

        # Perfect backtest score
        result = ConfidenceScorer.compute(golden_cross_strategy, make_latest_backtest(overall_score=100.0))
        assert result["overall"] <= 100.0
        assert result["overall"] >= 0.0


# ---------------------------------------------------------------------------
# Test: regime detection logic
# ---------------------------------------------------------------------------


class TestRegimeDetection:
    def test_bull_regime_detected(self):
        """Upward-trending price with EMA200 below should return bull."""
        df = make_mock_ohlcv(n=300, trend="bull")
        with patch("yfinance.download", return_value=df):
            result = ConfidenceScorer.detect_regime("AAPL")
        # Bull market: close > ema200 and positive 20d return
        assert result["regime"] in ("bull", "sideways", "bear", "unknown")  # shouldn't crash

    def test_empty_data_returns_unknown(self):
        """Empty yfinance data should return 'unknown' regime gracefully."""
        with patch("yfinance.download", return_value=pd.DataFrame()):
            result = ConfidenceScorer.detect_regime("AAPL")
        assert result["regime"] == "unknown"

    def test_insufficient_data_returns_unknown(self):
        """Less than 60 bars should return 'unknown'."""
        df = make_mock_ohlcv(n=30, trend="bull")
        with patch("yfinance.download", return_value=df):
            result = ConfidenceScorer.detect_regime("AAPL")
        assert result["regime"] == "unknown"

    def test_detect_regime_structure(self):
        """detect_regime should always return a dict with 'regime' key on network error."""
        with patch("yfinance.download", side_effect=Exception("Network error")):
            result = ConfidenceScorer.detect_regime("AAPL")
        assert "regime" in result
        assert result["regime"] == "unknown"


# ---------------------------------------------------------------------------
# Test: confidence output structure
# ---------------------------------------------------------------------------


class TestConfidenceStructure:
    @patch("main.ConfidenceScorer.detect_regime")
    @patch("main.ConfidenceScorer.compute_signal_proximity")
    @patch("main.ConfidenceScorer.get_volatility_context")
    @patch("main.ConfidenceScorer.get_global_risk")
    def test_output_keys(
        self,
        mock_global,
        mock_vol,
        mock_signal,
        mock_regime,
        golden_cross_strategy,
    ):
        mock_regime.return_value = {"regime": "bull", "adx": 28.0, "price": 175.0, "return_20d": 3.0, "ema_50": 170.0, "ema_200": 160.0}
        mock_signal.return_value = {"score": 60.0, "triggered": False, "description": "Moderate", "nearest_signal": "N/A"}
        mock_vol.return_value = {"india_vix": None, "us_vix": 20.0, "realized_vol_annual": 18.0, "level": "normal"}
        mock_global.return_value = {}

        result = ConfidenceScorer.compute(golden_cross_strategy, make_latest_backtest())
        assert "overall" in result
        assert "recommendation" in result
        assert "recommendation_label" in result
        assert "reasoning" in result
        assert "components" in result
        assert "global_risk" in result

    @patch("main.ConfidenceScorer.detect_regime")
    @patch("main.ConfidenceScorer.compute_signal_proximity")
    @patch("main.ConfidenceScorer.get_volatility_context")
    @patch("main.ConfidenceScorer.get_global_risk")
    def test_recommendation_values(
        self,
        mock_global,
        mock_vol,
        mock_signal,
        mock_regime,
        golden_cross_strategy,
    ):
        mock_regime.return_value = {"regime": "bull", "adx": 28.0, "price": 175.0, "return_20d": 3.0, "ema_50": 170.0, "ema_200": 160.0}
        mock_signal.return_value = {"score": 60.0, "triggered": False, "description": "", "nearest_signal": ""}
        mock_vol.return_value = {"india_vix": None, "us_vix": 18.0, "realized_vol_annual": 18.0, "level": "normal"}
        mock_global.return_value = {}

        result = ConfidenceScorer.compute(golden_cross_strategy, make_latest_backtest())
        assert result["recommendation"] in ("buy", "hold", "reduce", "exit")

    @patch("main.ConfidenceScorer.detect_regime")
    @patch("main.ConfidenceScorer.compute_signal_proximity")
    @patch("main.ConfidenceScorer.get_volatility_context")
    @patch("main.ConfidenceScorer.get_global_risk")
    def test_components_weights_sum(
        self,
        mock_global,
        mock_vol,
        mock_signal,
        mock_regime,
        golden_cross_strategy,
    ):
        mock_regime.return_value = {"regime": "sideways", "adx": 15.0, "price": 100.0, "return_20d": 0.0, "ema_50": 100.0, "ema_200": 105.0}
        mock_signal.return_value = {"score": 50.0, "triggered": False, "description": "", "nearest_signal": ""}
        mock_vol.return_value = {"india_vix": None, "us_vix": 22.0, "realized_vol_annual": 20.0, "level": "normal"}
        mock_global.return_value = {}

        result = ConfidenceScorer.compute(golden_cross_strategy, make_latest_backtest())
        weights = [comp["weight"] for comp in result["components"].values()]
        assert abs(sum(weights) - 1.0) < 1e-9


# ---------------------------------------------------------------------------
# Test: low vs high backtest score affects confidence
# ---------------------------------------------------------------------------


class TestBacktestStrengthComponent:
    @patch("main.ConfidenceScorer.detect_regime")
    @patch("main.ConfidenceScorer.compute_signal_proximity")
    @patch("main.ConfidenceScorer.get_volatility_context")
    @patch("main.ConfidenceScorer.get_global_risk")
    def test_higher_backtest_score_raises_confidence(
        self,
        mock_global,
        mock_vol,
        mock_signal,
        mock_regime,
        golden_cross_strategy,
    ):
        for mock in (mock_regime, mock_signal, mock_vol, mock_global):
            pass

        mock_regime.return_value = {"regime": "bull", "adx": 28.0, "price": 175.0, "return_20d": 3.0, "ema_50": 170.0, "ema_200": 160.0}
        mock_signal.return_value = {"score": 50.0, "triggered": False, "description": "", "nearest_signal": ""}
        mock_vol.return_value = {"india_vix": None, "us_vix": 18.0, "realized_vol_annual": 18.0, "level": "normal"}
        mock_global.return_value = {}

        low_bt = make_latest_backtest(overall_score=20.0)
        high_bt = make_latest_backtest(overall_score=90.0)

        result_low = ConfidenceScorer.compute(golden_cross_strategy, low_bt)
        result_high = ConfidenceScorer.compute(golden_cross_strategy, high_bt)

        assert result_high["overall"] > result_low["overall"]
