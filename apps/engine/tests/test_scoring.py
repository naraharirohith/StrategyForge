"""
Unit tests for ScoreCalculator.
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services import ScoreCalculator


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_metrics(
    sharpe=1.5,
    max_drawdown=-10.0,
    win_rate=55.0,
    profit_factor=1.5,
    monthly_returns=None,
    regime_performance=None,
):
    if monthly_returns is None:
        monthly_returns = [{"return_percent": 2.0}, {"return_percent": 1.5}, {"return_percent": 2.5}]
    if regime_performance is None:
        regime_performance = [
            {"regime": "bull", "return_percent": 3.0},
            {"regime": "bear", "return_percent": -1.0},
        ]
    return {
        "sharpe_ratio": sharpe,
        "max_drawdown_percent": max_drawdown,
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "monthly_returns": monthly_returns,
        "regime_performance": regime_performance,
    }


# ---------------------------------------------------------------------------
# Grade mapping
# ---------------------------------------------------------------------------


class TestGradeMapping:
    def test_s_grade(self):
        metrics = make_metrics(sharpe=3.0, max_drawdown=-2.0, win_rate=70.0, profit_factor=3.0)
        result = ScoreCalculator.compute(metrics)
        assert result["grade"] in ("S", "A")  # very strong metrics

    def test_f_grade_negative_sharpe(self):
        metrics = make_metrics(
            sharpe=0.0,
            max_drawdown=-60.0,
            win_rate=20.0,
            profit_factor=0.3,
            monthly_returns=[{"return_percent": -5.0}, {"return_percent": -4.0}, {"return_percent": -3.0}],
            regime_performance=[{"regime": "bull", "return_percent": -2.0}],
        )
        result = ScoreCalculator.compute(metrics)
        assert result["overall"] < 40
        assert result["grade"] == "F"

    def test_grade_d_range(self):
        metrics = make_metrics(sharpe=0.1, max_drawdown=-40.0, win_rate=30.0, profit_factor=0.8)
        result = ScoreCalculator.compute(metrics)
        assert result["grade"] in ("D", "F")

    def test_grade_b_range(self):
        metrics = make_metrics(sharpe=2.0, max_drawdown=-12.0, win_rate=60.0, profit_factor=2.0)
        result = ScoreCalculator.compute(metrics)
        assert result["grade"] in ("A", "B", "C")


# ---------------------------------------------------------------------------
# Sharpe ratio scoring
# ---------------------------------------------------------------------------


class TestSharpeScoring:
    def test_negative_sharpe_gets_zero_score(self):
        metrics = make_metrics(sharpe=-1.0)
        result = ScoreCalculator.compute(metrics)
        breakdown = result["breakdown"]["sharpe_ratio"]
        assert breakdown["score"] == 0

    def test_high_sharpe_gets_high_score(self):
        metrics = make_metrics(sharpe=3.0)
        result = ScoreCalculator.compute(metrics)
        breakdown = result["breakdown"]["sharpe_ratio"]
        assert breakdown["score"] == 100

    def test_sharpe_mid_range(self):
        metrics = make_metrics(sharpe=1.5)
        result = ScoreCalculator.compute(metrics)
        breakdown = result["breakdown"]["sharpe_ratio"]
        # sharpe=1.5 → 1.5/3 * 100 = 50
        assert abs(breakdown["score"] - 50.0) < 1.0


# ---------------------------------------------------------------------------
# Win rate and profit factor
# ---------------------------------------------------------------------------


class TestWinRateAndProfitFactor:
    def test_high_win_rate_and_profit_factor_gets_high_score(self):
        metrics = make_metrics(
            sharpe=2.5,
            max_drawdown=-5.0,
            win_rate=70.0,
            profit_factor=3.0,
            monthly_returns=[{"return_percent": 3.0}] * 12,
            regime_performance=[
                {"regime": "bull", "return_percent": 4.0},
                {"regime": "bear", "return_percent": 1.0},
                {"regime": "sideways", "return_percent": 2.0},
            ],
        )
        result = ScoreCalculator.compute(metrics)
        assert result["overall"] >= 70

    def test_low_win_rate_reduces_score(self):
        high_wr = make_metrics(win_rate=70.0)
        low_wr = make_metrics(win_rate=25.0)
        high_result = ScoreCalculator.compute(high_wr)
        low_result = ScoreCalculator.compute(low_wr)
        assert high_result["overall"] > low_result["overall"]

    def test_profit_factor_above_1_required_for_good_score(self):
        good_pf = make_metrics(profit_factor=2.0)
        bad_pf = make_metrics(profit_factor=0.5)
        good_result = ScoreCalculator.compute(good_pf)
        bad_result = ScoreCalculator.compute(bad_pf)
        assert good_result["breakdown"]["profit_factor"]["score"] > bad_result["breakdown"]["profit_factor"]["score"]


# ---------------------------------------------------------------------------
# Score structure
# ---------------------------------------------------------------------------


class TestScoreStructure:
    def test_output_keys_present(self):
        result = ScoreCalculator.compute(make_metrics())
        assert "overall" in result
        assert "breakdown" in result
        assert "grade" in result
        assert "publishable" in result
        assert "verified" in result

    def test_overall_in_range(self):
        result = ScoreCalculator.compute(make_metrics())
        assert 0 <= result["overall"] <= 100

    def test_publishable_threshold(self):
        low_metrics = make_metrics(
            sharpe=0.0, max_drawdown=-60.0, win_rate=20.0, profit_factor=0.3,
            monthly_returns=[{"return_percent": -5.0}] * 3,
            regime_performance=[{"regime": "bull", "return_percent": -2.0}],
        )
        high_metrics = make_metrics(
            sharpe=2.5, max_drawdown=-5.0, win_rate=70.0, profit_factor=3.0,
            monthly_returns=[{"return_percent": 3.0}] * 12,
            regime_performance=[
                {"regime": "bull", "return_percent": 4.0},
                {"regime": "bear", "return_percent": 1.0},
            ],
        )
        low_result = ScoreCalculator.compute(low_metrics)
        high_result = ScoreCalculator.compute(high_metrics)
        assert not low_result["publishable"]
        assert high_result["publishable"]

    def test_verified_threshold(self):
        high_metrics = make_metrics(
            sharpe=2.5, max_drawdown=-5.0, win_rate=70.0, profit_factor=3.0,
            monthly_returns=[{"return_percent": 3.0}] * 12,
            regime_performance=[
                {"regime": "bull", "return_percent": 4.0},
                {"regime": "bear", "return_percent": 1.0},
            ],
        )
        result = ScoreCalculator.compute(high_metrics)
        assert result["verified"]

    def test_weights_sum_to_one(self):
        result = ScoreCalculator.compute(make_metrics())
        total_weight = sum(
            v["weight"] for v in result["breakdown"].values()
        )
        assert abs(total_weight - 1.0) < 1e-9
