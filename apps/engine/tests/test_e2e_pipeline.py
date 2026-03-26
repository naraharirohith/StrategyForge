"""
End-to-end integration tests for the full StrategyForge pipeline.

Tests the complete flow: strategy -> data fetch -> indicators -> backtest ->
scoring -> walk-forward -> confidence, using mocked market data.
"""

import sys, os
import pytest
from unittest.mock import patch
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def make_trending_ohlcv(n=600, trend="up"):
    """Generate synthetic OHLCV with clear trend for predictable backtest behavior."""
    np.random.seed(42)
    dates = pd.date_range("2019-01-01", periods=n, freq="B")
    drift = 0.001 if trend == "up" else -0.0005
    vol = 0.012
    log_returns = np.random.normal(drift, vol, n)
    close = 100.0 * np.exp(np.cumsum(log_returns))
    high = close * (1 + np.abs(np.random.normal(0, 0.005, n)))
    low = close * (1 - np.abs(np.random.normal(0, 0.005, n)))
    open_ = close * (1 + np.random.normal(0, 0.003, n))
    volume = np.random.randint(1_000_000, 10_000_000, n).astype(float)
    return pd.DataFrame(
        {"Open": open_, "High": high, "Low": low, "Close": close, "Volume": volume},
        index=dates,
    )


# A comprehensive strategy using multiple indicator types
FULL_STRATEGY = {
    "schema_version": "1.0.0",
    "name": "E2E Test Strategy",
    "description": "Multi-indicator momentum strategy for E2E testing",
    "style": "momentum",
    "risk_level": "moderate",
    "universe": {"market": "US", "asset_class": "equity", "tickers": ["AAPL"]},
    "timeframe": "1d",
    "indicators": [
        {"id": "ema_20", "type": "EMA", "params": {"period": 20}},
        {"id": "ema_50", "type": "EMA", "params": {"period": 50}},
        {"id": "rsi_14", "type": "RSI", "params": {"period": 14}},
        {"id": "macd", "type": "MACD", "params": {"fast": 12, "slow": 26, "signal": 9}},
        {"id": "bbands", "type": "BBANDS", "params": {"period": 20, "std_dev": 2}},
        {"id": "atr_14", "type": "ATR", "params": {"period": 14}},
    ],
    "entry_rules": [
        {
            "id": "e1",
            "name": "Momentum Entry",
            "side": "long",
            "conditions": {
                "logic": "AND",
                "conditions": [
                    {"id": "c1", "left": {"type": "indicator", "indicator_id": "ema_20"}, "operator": "gt", "right": {"type": "indicator", "indicator_id": "ema_50"}},
                    {"id": "c2", "left": {"type": "indicator", "indicator_id": "rsi_14"}, "operator": "lt", "right": {"type": "constant", "value": 70}},
                ],
            },
            "position_sizing": {"method": "percent_of_portfolio", "percent": 15},
        }
    ],
    "exit_rules": [
        {"id": "x1", "name": "Stop Loss", "type": "stop_loss", "value": 5, "priority": 1},
        {"id": "x2", "name": "Take Profit", "type": "take_profit", "value": 12, "priority": 2},
        {"id": "x3", "name": "Trailing Stop", "type": "trailing_stop", "value": 8, "priority": 3},
    ],
    "risk_management": {"max_portfolio_drawdown_percent": 15, "max_position_count": 5},
    "backtest_config": {
        "initial_capital": 100000,
        "currency": "USD",
        "commission_percent": 0.1,
        "slippage_percent": 0.05,
    },
}

VALID_GRADES = {"S", "A", "B", "C", "D", "F"}

SCORE_BREAKDOWN_KEYS = {
    "sharpe_ratio",
    "max_drawdown",
    "win_rate",
    "profit_factor",
    "consistency",
    "regime_score",
}

REQUIRED_TRADE_FIELDS = {
    "ticker",
    "side",
    "entry_date",
    "exit_date",
    "entry_price",
    "exit_price",
    "pnl",
    "pnl_percent",
    "exit_reason",
}


def _run_backtest_with_mock():
    """Helper: run backtest with mocked yfinance, return response JSON."""
    mock_df = make_trending_ohlcv(n=600, trend="up")
    with patch("services.data_fetcher.get_cached", return_value=None):
        with patch("yfinance.download", return_value=mock_df):
            response = client.post("/backtest", json={"strategy": FULL_STRATEGY})
    return response


class TestE2EPipeline:
    """End-to-end pipeline tests. Earlier tests store state for later tests."""

    # Class-level storage for sharing backtest result across methods
    _backtest_response = None
    _backtest_result = None

    @classmethod
    def _ensure_backtest(cls):
        """Run the backtest once and cache the result at class level."""
        if cls._backtest_response is None:
            resp = _run_backtest_with_mock()
            cls._backtest_response = resp
            data = resp.json()
            if data.get("success") and data.get("result"):
                cls._backtest_result = data["result"]

    # ------------------------------------------------------------------
    # 1. Full backtest pipeline
    # ------------------------------------------------------------------
    def test_backtest_full_pipeline(self):
        """POST /backtest with a valid strategy returns success with all expected fields."""
        self.__class__._ensure_backtest()
        resp = self.__class__._backtest_response
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True, f"Backtest failed: {data.get('error')}"
        assert "result" in data
        assert "duration_ms" in data
        assert data["duration_ms"] >= 0

    # ------------------------------------------------------------------
    # 2. Result has all sections
    # ------------------------------------------------------------------
    def test_result_has_all_sections(self):
        """Check result has summary, score, equity_curve, drawdown_curve, trades, monthly_returns, walk_forward."""
        self.__class__._ensure_backtest()
        result = self.__class__._backtest_result
        assert result is not None, "No backtest result available"

        required_sections = [
            "summary",
            "score",
            "equity_curve",
            "drawdown_curve",
            "trades",
            "monthly_returns",
            "walk_forward",
        ]
        for section in required_sections:
            assert section in result, f"Missing section: {section}"

    # ------------------------------------------------------------------
    # 3. Score integrity
    # ------------------------------------------------------------------
    def test_score_integrity(self):
        """Verify score.overall in 0-100, grade in valid set, breakdown has 6 keys with value/score/weight."""
        self.__class__._ensure_backtest()
        score = self.__class__._backtest_result["score"]

        # Overall range
        assert 0 <= score["overall"] <= 100, f"Score {score['overall']} out of range"

        # Valid grade
        assert score["grade"] in VALID_GRADES, f"Invalid grade: {score['grade']}"

        # Breakdown has all 6 components
        breakdown = score["breakdown"]
        assert set(breakdown.keys()) == SCORE_BREAKDOWN_KEYS, (
            f"Breakdown keys mismatch: got {set(breakdown.keys())}, expected {SCORE_BREAKDOWN_KEYS}"
        )

        # Each component has value, score, weight
        for key, component in breakdown.items():
            assert "value" in component, f"{key} missing 'value'"
            assert "score" in component, f"{key} missing 'score'"
            assert "weight" in component, f"{key} missing 'weight'"
            assert 0 <= component["score"] <= 100, f"{key} score {component['score']} out of range"
            assert 0 < component["weight"] <= 1.0, f"{key} weight {component['weight']} invalid"

    # ------------------------------------------------------------------
    # 4. Summary metrics are reasonable
    # ------------------------------------------------------------------
    def test_summary_metrics_reasonable(self):
        """Verify total_return, sharpe, drawdown, win_rate, profit_factor are within sane ranges."""
        self.__class__._ensure_backtest()
        summary = self.__class__._backtest_result["summary"]

        # total_return should be a finite number
        tr = summary["total_return_percent"]
        assert isinstance(tr, (int, float)) and np.isfinite(tr), f"total_return is not finite: {tr}"

        # sharpe should be finite
        sharpe = summary["sharpe_ratio"]
        assert isinstance(sharpe, (int, float)) and np.isfinite(sharpe), f"sharpe is not finite: {sharpe}"

        # max_drawdown should be <= 0 (it is a percentage, negative or zero)
        dd = summary["max_drawdown_percent"]
        assert isinstance(dd, (int, float)) and np.isfinite(dd), f"drawdown is not finite: {dd}"
        assert dd <= 0, f"max_drawdown_percent should be <= 0, got {dd}"

        # win_rate in [0, 100]
        wr = summary["win_rate"]
        assert 0 <= wr <= 100, f"win_rate out of range: {wr}"

        # profit_factor should be >= 0 and finite
        pf = summary["profit_factor"]
        assert isinstance(pf, (int, float)) and np.isfinite(pf), f"profit_factor not finite: {pf}"
        assert pf >= 0, f"profit_factor should be >= 0, got {pf}"

    # ------------------------------------------------------------------
    # 5. Trades have required fields
    # ------------------------------------------------------------------
    def test_trades_have_required_fields(self):
        """Each trade has ticker, side, entry_date, exit_date, entry_price, exit_price, pnl, pnl_percent, exit_reason."""
        self.__class__._ensure_backtest()
        trades = self.__class__._backtest_result["trades"]
        assert isinstance(trades, list)

        # With 600 bars of uptrending data and EMA 20/50 cross, we expect at least 1 trade
        assert len(trades) > 0, "Expected at least one trade with trending data"

        for i, trade in enumerate(trades):
            for field in REQUIRED_TRADE_FIELDS:
                assert field in trade, f"Trade {i} missing field: {field}"

            # Sanity: entry_price and exit_price should be positive
            assert trade["entry_price"] > 0, f"Trade {i} entry_price <= 0"
            assert trade["exit_price"] > 0, f"Trade {i} exit_price <= 0"

    # ------------------------------------------------------------------
    # 6. Equity curve starts near initial capital
    # ------------------------------------------------------------------
    def test_equity_curve_monotonic_start(self):
        """First equity point is close to initial_capital."""
        self.__class__._ensure_backtest()
        eq = self.__class__._backtest_result["equity_curve"]
        assert isinstance(eq, list)
        assert len(eq) > 0, "Equity curve is empty"

        initial_capital = FULL_STRATEGY["backtest_config"]["initial_capital"]
        first_value = eq[0][1]
        # First equity value should be within 5% of initial capital (before any trades)
        assert abs(first_value - initial_capital) / initial_capital < 0.05, (
            f"First equity value {first_value} not close to initial capital {initial_capital}"
        )

    # ------------------------------------------------------------------
    # 7. Monthly returns present
    # ------------------------------------------------------------------
    def test_monthly_returns_present(self):
        """monthly_returns is a list (may be empty for short periods)."""
        self.__class__._ensure_backtest()
        mr = self.__class__._backtest_result["monthly_returns"]
        assert isinstance(mr, list), f"monthly_returns should be a list, got {type(mr)}"

        # With 600 bars of daily data, we should have many months
        if len(mr) > 0:
            first = mr[0]
            assert "month" in first, "monthly return entry missing 'month'"
            assert "return_percent" in first, "monthly return entry missing 'return_percent'"
            assert "equity" in first, "monthly return entry missing 'equity'"

    # ------------------------------------------------------------------
    # 8. Walk-forward structure
    # ------------------------------------------------------------------
    def test_walk_forward_structure(self):
        """If walk_forward is not null, verify it has expected fields."""
        self.__class__._ensure_backtest()
        wf = self.__class__._backtest_result["walk_forward"]
        # walk_forward may be None if insufficient data; presence is checked in test_result_has_all_sections
        if wf is not None:
            expected_fields = [
                "in_sample_score",
                "out_of_sample_score",
                "degradation_percent",
                "overfitting_risk",
            ]
            for field in expected_fields:
                assert field in wf, f"walk_forward missing field: {field}"

            # Scores should be in reasonable range
            assert 0 <= wf["in_sample_score"] <= 100, f"in_sample_score out of range: {wf['in_sample_score']}"
            assert 0 <= wf["out_of_sample_score"] <= 100, f"out_of_sample_score out of range: {wf['out_of_sample_score']}"
            assert isinstance(wf["overfitting_risk"], str), "overfitting_risk should be a string"

    # ------------------------------------------------------------------
    # 9. Confidence pipeline
    # ------------------------------------------------------------------
    def test_confidence_pipeline(self):
        """POST /confidence with strategy + backtest result returns valid confidence."""
        self.__class__._ensure_backtest()
        result = self.__class__._backtest_result
        assert result is not None

        # Mock all yfinance calls in the confidence scorer
        regime_info = {
            "regime": "bull",
            "adx": 28.0,
            "price": 175.0,
            "return_20d": 3.0,
            "ema_50": 170.0,
            "ema_200": 160.0,
        }
        signal_info = {
            "score": 65.0,
            "triggered": False,
            "description": "Momentum Entry: ~35% away from trigger",
            "nearest_signal": "Momentum Entry: ~35% away from trigger",
        }
        vol_info = {
            "india_vix": None,
            "us_vix": 18.0,
            "realized_vol_annual": 16.5,
            "level": "normal",
        }
        global_risk = {
            "sp500_5d_return": 1.2,
            "sp500_trend": "up",
        }

        with patch("main.ConfidenceScorer.detect_regime", return_value=regime_info):
            with patch("main.ConfidenceScorer.compute_signal_proximity", return_value=signal_info):
                with patch("main.ConfidenceScorer.get_volatility_context", return_value=vol_info):
                    with patch("main.ConfidenceScorer.get_global_risk", return_value=global_risk):
                        response = client.post(
                            "/confidence",
                            json={
                                "strategy": FULL_STRATEGY,
                                "latest_backtest": result,
                            },
                        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True, f"Confidence failed: {data.get('error')}"

        confidence = data["confidence"]
        assert "overall" in confidence
        assert 0 <= confidence["overall"] <= 100
        assert "recommendation" in confidence
        assert confidence["recommendation"] in {"buy", "hold", "reduce", "exit"}
        assert "recommendation_label" in confidence
        assert "reasoning" in confidence
        assert isinstance(confidence["reasoning"], str)

        # Components
        assert "components" in confidence
        components = confidence["components"]
        expected_components = {"backtest_strength", "regime_fit", "signal_proximity", "volatility_context"}
        assert set(components.keys()) == expected_components, (
            f"Component keys mismatch: got {set(components.keys())}"
        )

        for comp_name, comp in components.items():
            assert "score" in comp, f"Component {comp_name} missing 'score'"
            assert "weight" in comp, f"Component {comp_name} missing 'weight'"
            assert "description" in comp, f"Component {comp_name} missing 'description'"

        # Regime detection info
        regime_fit = components["regime_fit"]
        assert "current_regime" in regime_fit
        assert regime_fit["current_regime"] in {"bull", "bear", "sideways", "unknown"}
        assert "regime_info" in regime_fit

    # ------------------------------------------------------------------
    # 10. Deterministic results
    # ------------------------------------------------------------------
    def test_deterministic_results(self):
        """Running the same backtest twice with same mock data produces same results."""
        resp1 = _run_backtest_with_mock()
        resp2 = _run_backtest_with_mock()

        data1 = resp1.json()
        data2 = resp2.json()

        assert data1["success"] is True
        assert data2["success"] is True

        r1 = data1["result"]
        r2 = data2["result"]

        # Scores must match exactly
        assert r1["score"]["overall"] == r2["score"]["overall"], (
            f"Score mismatch: {r1['score']['overall']} vs {r2['score']['overall']}"
        )
        assert r1["score"]["grade"] == r2["score"]["grade"]

        # Summary metrics must match
        for key in ["total_return_percent", "sharpe_ratio", "max_drawdown_percent", "win_rate", "profit_factor", "total_trades"]:
            assert r1["summary"][key] == r2["summary"][key], (
                f"Summary mismatch on {key}: {r1['summary'][key]} vs {r2['summary'][key]}"
            )

        # Trade count must match
        assert len(r1["trades"]) == len(r2["trades"]), (
            f"Trade count mismatch: {len(r1['trades'])} vs {len(r2['trades'])}"
        )

        # Equity curve length must match
        assert len(r1["equity_curve"]) == len(r2["equity_curve"]), (
            f"Equity curve length mismatch: {len(r1['equity_curve'])} vs {len(r2['equity_curve'])}"
        )
