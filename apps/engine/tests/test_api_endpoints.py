"""
Integration tests for the FastAPI engine endpoints.

Uses FastAPI's TestClient — no network calls needed for most tests.
yfinance calls are mocked where needed.
"""

import sys
import os
import pytest
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

CLAUDE_MD_STRATEGY = {
    "schema_version": "1.0.0",
    "name": "Test",
    "description": "Test",
    "style": "momentum",
    "risk_level": "moderate",
    "universe": {"market": "US", "asset_class": "equity", "tickers": ["AAPL"]},
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
    "risk_management": {"max_portfolio_drawdown_percent": 15, "max_position_count": 5},
    "backtest_config": {
        "initial_capital": 100000,
        "currency": "USD",
        "commission_percent": 0.1,
        "slippage_percent": 0.05,
    },
}

STRATEGY_NO_STOP_LOSS = {
    "schema_version": "1.0.0",
    "name": "No SL",
    "description": "Strategy without stop loss",
    "style": "momentum",
    "risk_level": "moderate",
    "universe": {"market": "US", "asset_class": "equity", "tickers": ["AAPL"]},
    "timeframe": "1d",
    "indicators": [],
    "entry_rules": [
        {
            "id": "e1",
            "name": "Always Enter",
            "side": "long",
            "conditions": {
                "logic": "AND",
                "conditions": [
                    {
                        "id": "c1",
                        "left": {"type": "constant", "value": 1},
                        "operator": "gt",
                        "right": {"type": "constant", "value": 0},
                    }
                ],
            },
            "position_sizing": {"method": "percent_of_portfolio", "percent": 10},
        }
    ],
    "exit_rules": [
        {"id": "x1", "name": "Take Profit", "type": "take_profit", "value": 20, "priority": 1}
    ],
    "risk_management": {},
    "backtest_config": {
        "initial_capital": 100000,
        "currency": "USD",
        "commission_percent": 0.1,
        "slippage_percent": 0.05,
    },
}

RELIANCE_STRATEGY = {
    **CLAUDE_MD_STRATEGY,
    "name": "Reliance Momentum",
    "universe": {"market": "IN", "asset_class": "equity", "tickers": ["RELIANCE.NS"]},
}


def make_synthetic_ohlcv(n=500, ticker_name="AAPL"):
    """Return a synthetic OHLCV DataFrame for mocking yfinance."""
    np.random.seed(42)
    dates = pd.date_range("2020-01-01", periods=n, freq="B")
    close = 100.0 * np.exp(np.cumsum(np.random.normal(0.0003, 0.012, n)))
    high = close * (1 + np.abs(np.random.normal(0, 0.004, n)))
    low = close * (1 - np.abs(np.random.normal(0, 0.004, n)))
    return pd.DataFrame(
        {
            "Open": close * (1 + np.random.normal(0, 0.002, n)),
            "High": high,
            "Low": low,
            "Close": close,
            "Volume": np.random.randint(1_000_000, 5_000_000, n).astype(float),
        },
        index=dates,
    )


# ---------------------------------------------------------------------------
# /health endpoint
# ---------------------------------------------------------------------------


class TestHealth:
    def test_health_returns_200(self):
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_has_correct_structure(self):
        response = client.get("/health")
        data = response.json()
        assert "status" in data
        assert "engine_version" in data
        assert "supported_indicators" in data

    def test_health_status_is_ok(self):
        response = client.get("/health")
        data = response.json()
        assert data["status"] == "ok"

    def test_health_supported_indicators_is_list(self):
        response = client.get("/health")
        data = response.json()
        assert isinstance(data["supported_indicators"], list)
        assert len(data["supported_indicators"]) > 0

    def test_health_has_key_indicators(self):
        response = client.get("/health")
        indicators = response.json()["supported_indicators"]
        for expected in ("EMA", "RSI", "MACD", "BBANDS"):
            assert expected in indicators


# ---------------------------------------------------------------------------
# /backtest endpoint — golden cross strategy (mocked yfinance)
# ---------------------------------------------------------------------------


class TestBacktestGoldenCross:
    def test_backtest_returns_200(self):
        mock_df = make_synthetic_ohlcv()
        with patch("yfinance.download", return_value=mock_df):
            response = client.post("/backtest", json={"strategy": CLAUDE_MD_STRATEGY})
        assert response.status_code == 200

    def test_backtest_success_field(self):
        mock_df = make_synthetic_ohlcv()
        with patch("yfinance.download", return_value=mock_df):
            response = client.post("/backtest", json={"strategy": CLAUDE_MD_STRATEGY})
        data = response.json()
        assert data["success"] is True

    def test_backtest_result_has_summary(self):
        mock_df = make_synthetic_ohlcv()
        with patch("yfinance.download", return_value=mock_df):
            response = client.post("/backtest", json={"strategy": CLAUDE_MD_STRATEGY})
        data = response.json()
        assert "result" in data
        assert "summary" in data["result"]

    def test_backtest_result_has_score(self):
        mock_df = make_synthetic_ohlcv()
        with patch("yfinance.download", return_value=mock_df):
            response = client.post("/backtest", json={"strategy": CLAUDE_MD_STRATEGY})
        result = response.json()["result"]
        assert "score" in result
        assert "overall" in result["score"]
        assert 0 <= result["score"]["overall"] <= 100

    def test_backtest_result_has_trades(self):
        mock_df = make_synthetic_ohlcv()
        with patch("yfinance.download", return_value=mock_df):
            response = client.post("/backtest", json={"strategy": CLAUDE_MD_STRATEGY})
        result = response.json()["result"]
        assert "trades" in result
        assert isinstance(result["trades"], list)

    def test_backtest_result_has_equity_curve(self):
        mock_df = make_synthetic_ohlcv()
        with patch("yfinance.download", return_value=mock_df):
            response = client.post("/backtest", json={"strategy": CLAUDE_MD_STRATEGY})
        result = response.json()["result"]
        assert "equity_curve" in result
        assert isinstance(result["equity_curve"], list)

    def test_backtest_summary_keys(self):
        mock_df = make_synthetic_ohlcv()
        with patch("yfinance.download", return_value=mock_df):
            response = client.post("/backtest", json={"strategy": CLAUDE_MD_STRATEGY})
        summary = response.json()["result"]["summary"]
        required_keys = [
            "total_return_percent",
            "annualized_return_percent",
            "sharpe_ratio",
            "sortino_ratio",
            "max_drawdown_percent",
            "win_rate",
            "profit_factor",
            "total_trades",
            "alpha",
            "beta",
        ]
        for key in required_keys:
            assert key in summary, f"Missing key: {key}"

    def test_backtest_duration_ms_present(self):
        mock_df = make_synthetic_ohlcv()
        with patch("yfinance.download", return_value=mock_df):
            response = client.post("/backtest", json={"strategy": CLAUDE_MD_STRATEGY})
        assert "duration_ms" in response.json()


# ---------------------------------------------------------------------------
# /backtest — rejects strategy without stop_loss
# ---------------------------------------------------------------------------


class TestBacktestNoStopLoss:
    def test_strategy_without_stop_loss_still_runs(self):
        """
        The engine itself runs the backtest; the API layer (Express) enforces stop_loss.
        The engine should return success=True even without stop_loss.
        """
        mock_df = make_synthetic_ohlcv()
        with patch("yfinance.download", return_value=mock_df):
            response = client.post("/backtest", json={"strategy": STRATEGY_NO_STOP_LOSS})
        assert response.status_code == 200
        # Engine will succeed — validation is in the Express API layer
        data = response.json()
        assert "success" in data

    def test_stop_loss_absence_detectable(self):
        """Confirm the strategy fixture genuinely has no stop_loss rule."""
        has_sl = any(
            r.get("type") == "stop_loss"
            for r in STRATEGY_NO_STOP_LOSS["exit_rules"]
        )
        assert not has_sl


# ---------------------------------------------------------------------------
# /backtest — Indian market ticker (mocked)
# ---------------------------------------------------------------------------


class TestBacktestIndianMarket:
    def test_reliance_backtest_runs(self):
        mock_df = make_synthetic_ohlcv()
        with patch("yfinance.download", return_value=mock_df):
            response = client.post("/backtest", json={"strategy": RELIANCE_STRATEGY})
        assert response.status_code == 200

    def test_reliance_returns_result(self):
        mock_df = make_synthetic_ohlcv()
        with patch("yfinance.download", return_value=mock_df):
            response = client.post("/backtest", json={"strategy": RELIANCE_STRATEGY})
        data = response.json()
        assert data["success"] is True
        assert "result" in data


# ---------------------------------------------------------------------------
# /backtest — error cases
# ---------------------------------------------------------------------------


class TestBacktestErrors:
    def test_missing_strategy_field(self):
        response = client.post("/backtest", json={})
        # FastAPI should return 422 for missing required field
        assert response.status_code == 422

    def test_no_tickers(self):
        bad_strategy = dict(CLAUDE_MD_STRATEGY)
        bad_strategy = {**CLAUDE_MD_STRATEGY, "universe": {"market": "US", "tickers": []}}
        with patch("yfinance.download", return_value=make_synthetic_ohlcv()):
            response = client.post("/backtest", json={"strategy": bad_strategy})
        data = response.json()
        assert data["success"] is False

    def test_empty_data_from_yfinance(self):
        """When yfinance returns empty DataFrame, backtest should fail gracefully."""
        with patch("services.data_fetcher.get_cached", return_value=None):
            with patch("yfinance.download", return_value=pd.DataFrame()):
                response = client.post("/backtest", json={"strategy": CLAUDE_MD_STRATEGY})
        data = response.json()
        assert data["success"] is False
        assert "error" in data


# ---------------------------------------------------------------------------
# /confidence endpoint
# ---------------------------------------------------------------------------


class TestConfidenceEndpoint:
    def _get_fake_backtest_result(self):
        return {
            "score": {"overall": 65.0, "grade": "B"},
            "summary": {
                "total_return_percent": 18.0,
                "sharpe_ratio": 1.4,
                "max_drawdown_percent": -12.0,
                "win_rate": 55.0,
            },
        }

    def test_confidence_returns_200(self):
        with patch("main.ConfidenceScorer.detect_regime", return_value={"regime": "bull", "adx": 28.0, "price": 175.0, "return_20d": 3.0, "ema_50": 170.0, "ema_200": 160.0}):
            with patch("main.ConfidenceScorer.compute_signal_proximity", return_value={"score": 60.0, "triggered": False, "description": "", "nearest_signal": ""}):
                with patch("main.ConfidenceScorer.get_volatility_context", return_value={"india_vix": None, "us_vix": 18.0, "realized_vol_annual": 18.0, "level": "normal"}):
                    with patch("main.ConfidenceScorer.get_global_risk", return_value={}):
                        response = client.post(
                            "/confidence",
                            json={
                                "strategy": CLAUDE_MD_STRATEGY,
                                "latest_backtest": self._get_fake_backtest_result(),
                            },
                        )
        assert response.status_code == 200

    def test_confidence_success_field(self):
        with patch("main.ConfidenceScorer.detect_regime", return_value={"regime": "bull", "adx": 28.0, "price": 175.0, "return_20d": 3.0, "ema_50": 170.0, "ema_200": 160.0}):
            with patch("main.ConfidenceScorer.compute_signal_proximity", return_value={"score": 60.0, "triggered": False, "description": "", "nearest_signal": ""}):
                with patch("main.ConfidenceScorer.get_volatility_context", return_value={"india_vix": None, "us_vix": 18.0, "realized_vol_annual": 18.0, "level": "normal"}):
                    with patch("main.ConfidenceScorer.get_global_risk", return_value={}):
                        response = client.post(
                            "/confidence",
                            json={
                                "strategy": CLAUDE_MD_STRATEGY,
                                "latest_backtest": self._get_fake_backtest_result(),
                            },
                        )
        data = response.json()
        assert data["success"] is True

    def test_confidence_has_valid_object(self):
        with patch("main.ConfidenceScorer.detect_regime", return_value={"regime": "sideways", "adx": 15.0, "price": 150.0, "return_20d": 0.5, "ema_50": 149.0, "ema_200": 145.0}):
            with patch("main.ConfidenceScorer.compute_signal_proximity", return_value={"score": 40.0, "triggered": False, "description": "Far", "nearest_signal": "Far"}):
                with patch("main.ConfidenceScorer.get_volatility_context", return_value={"india_vix": None, "us_vix": 22.0, "realized_vol_annual": 20.0, "level": "normal"}):
                    with patch("main.ConfidenceScorer.get_global_risk", return_value={"sp500_trend": "flat"}):
                        response = client.post(
                            "/confidence",
                            json={
                                "strategy": CLAUDE_MD_STRATEGY,
                                "latest_backtest": self._get_fake_backtest_result(),
                            },
                        )
        confidence = response.json()["confidence"]
        assert "overall" in confidence
        assert 0 <= confidence["overall"] <= 100
        assert "recommendation" in confidence
        assert "components" in confidence

    def test_confidence_missing_fields_returns_error(self):
        response = client.post("/confidence", json={"strategy": CLAUDE_MD_STRATEGY})
        # FastAPI validation: missing 'latest_backtest' → 422
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# _compute_backtest_metrics — zero-trade early return
# ---------------------------------------------------------------------------


def test_zero_trade_result_has_warning():
    """
    When backtest produces 0 trades, result must include a zero_trades_warning
    and must NOT include walk_forward results (expensive + meaningless).
    """
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    import pandas as pd
    import numpy as np

    from main import _compute_backtest_metrics

    np.random.seed(42)
    n = 100
    dates = pd.date_range("2022-01-01", periods=n, freq="B")
    close = 100.0 * np.exp(np.cumsum(np.random.normal(0.0005, 0.01, n)))
    df = pd.DataFrame({
        "Open": close, "High": close * 1.005, "Low": close * 0.995,
        "Close": close, "Volume": 1_000_000.0,
    }, index=dates)

    equity_curve = [[str(d), 100_000.0] for d in dates]
    bt_result = {"trades": [], "equity_curve": equity_curve, "capital": 100_000.0}

    strategy = {
        "universe": {"market": "US"},
        "timeframe": "1d",
        "backtest_config": {"initial_capital": 100_000, "currency": "USD"},
        "indicators": [],
    }

    result = _compute_backtest_metrics(
        bt_result=bt_result, df=df, strategy=strategy,
        initial_capital=100_000, equity_curve_data=equity_curve,
        indicators=[],
    )

    assert "zero_trades_warning" in result, "Expected zero_trades_warning key in result"
    assert result["walk_forward"] is None, "Expected walk_forward to be None for 0-trade result"
    assert result["summary"]["total_trades"] == 0

    EXPECTED_TOP_LEVEL_KEYS = {
        "strategy_id", "run_id", "run_timestamp", "summary", "score",
        "equity_curve", "drawdown_curve", "trades", "monthly_returns",
        "regime_performance", "walk_forward", "zero_trades_warning",
    }
    assert EXPECTED_TOP_LEVEL_KEYS.issubset(result.keys()), (
        f"Missing keys: {EXPECTED_TOP_LEVEL_KEYS - result.keys()}"
    )


def test_screener_returns_structure():
    """Screener must return list with required fields — use synthetic data path."""
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from services.screener import _classify_trend, _pct_change
    import pandas as pd
    import numpy as np

    # Test trend classification
    assert _classify_trend(110, 100, 95, 90) == "bullish"   # above all MAs
    assert _classify_trend(85, 100, 95, 90) == "bearish"    # below all MAs
    assert _classify_trend(92, 100, 95, 90) == "sideways"   # below ema20+ema50, above ema200 only → score=1

    # Test pct_change
    close = pd.Series([100.0] * 22 + [110.0])
    assert abs(_pct_change(close, 21) - 10.0) < 0.1

    # Test invalid sector returns empty list
    from services.screener import screen_sector
    result = screen_sector("US", "nonexistent_sector_xyz", 5)
    assert result == []
