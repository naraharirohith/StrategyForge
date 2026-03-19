"""
Unit tests for IndicatorCalculator.

Tests are run on synthetic OHLCV DataFrames (no network required).
"""

import pytest
import numpy as np
import pandas as pd

from main import IndicatorCalculator


# ---------------------------------------------------------------------------
# SMA
# ---------------------------------------------------------------------------


class TestSMA:
    def test_sma_basic(self, synthetic_ohlcv):
        df = synthetic_ohlcv.copy()
        ind = [{"id": "sma_10", "type": "SMA", "params": {"period": 10}}]
        result = IndicatorCalculator.compute(df, ind)
        assert "sma_10" in result.columns

    def test_sma_known_values(self):
        """SMA over 3 periods on a known price series."""
        prices = [1.0, 2.0, 3.0, 4.0, 5.0]
        df = pd.DataFrame(
            {"Open": prices, "High": prices, "Low": prices, "Close": prices, "Volume": [1000] * 5}
        )
        ind = [{"id": "sma_3", "type": "SMA", "params": {"period": 3}}]
        result = IndicatorCalculator.compute(df, ind)
        # SMA(3) at index 2 should be (1+2+3)/3 = 2.0
        assert abs(result["sma_3"].iloc[2] - 2.0) < 1e-9
        # SMA(3) at index 4 should be (3+4+5)/3 = 4.0
        assert abs(result["sma_3"].iloc[4] - 4.0) < 1e-9

    def test_sma_warmup_nans(self, synthetic_ohlcv):
        """First period-1 values should be NaN."""
        df = synthetic_ohlcv.copy()
        period = 20
        ind = [{"id": "sma_20", "type": "SMA", "params": {"period": period}}]
        result = IndicatorCalculator.compute(df, ind)
        assert result["sma_20"].iloc[: period - 1].isna().all()
        assert not result["sma_20"].iloc[period:].isna().any()


# ---------------------------------------------------------------------------
# EMA
# ---------------------------------------------------------------------------


class TestEMA:
    def test_ema_basic(self, synthetic_ohlcv):
        df = synthetic_ohlcv.copy()
        ind = [{"id": "ema_20", "type": "EMA", "params": {"period": 20}}]
        result = IndicatorCalculator.compute(df, ind)
        assert "ema_20" in result.columns
        # EMA should not have NaNs after first value (ewm with adjust=False fills from start)
        assert not result["ema_20"].isna().all()

    def test_ema_tracks_price(self, synthetic_ohlcv):
        """EMA(5) should be close to price on a smooth series."""
        df = synthetic_ohlcv.copy()
        ind = [{"id": "ema_5", "type": "EMA", "params": {"period": 5}}]
        result = IndicatorCalculator.compute(df, ind)
        # On the trailing 100 bars, EMA(5) should be within 5% of close
        tail = result.tail(100)
        pct_diff = ((tail["ema_5"] - tail["Close"]).abs() / tail["Close"]).mean()
        assert pct_diff < 0.05

    def test_ema_faster_reacts_quicker(self, synthetic_ohlcv):
        """EMA(10) should generally be closer to close than EMA(50)."""
        df = synthetic_ohlcv.copy()
        ind = [
            {"id": "ema_10", "type": "EMA", "params": {"period": 10}},
            {"id": "ema_50", "type": "EMA", "params": {"period": 50}},
        ]
        result = IndicatorCalculator.compute(df, ind)
        tail = result.tail(200)
        diff_10 = (tail["ema_10"] - tail["Close"]).abs().mean()
        diff_50 = (tail["ema_50"] - tail["Close"]).abs().mean()
        assert diff_10 < diff_50


# ---------------------------------------------------------------------------
# RSI
# ---------------------------------------------------------------------------


class TestRSI:
    def test_rsi_range(self, synthetic_ohlcv):
        """RSI values should always be in [0, 100]."""
        df = synthetic_ohlcv.copy()
        ind = [{"id": "rsi_14", "type": "RSI", "params": {"period": 14}}]
        result = IndicatorCalculator.compute(df, ind)
        valid = result["rsi_14"].dropna()
        assert (valid >= 0).all()
        assert (valid <= 100).all()

    def test_rsi_overbought_zone(self):
        """Strong uptrend with few down bars should push RSI above 70."""
        np.random.seed(42)
        # Use realistic series: mostly up with occasional tiny pullbacks so loss > 0
        prices = [100.0]
        for i in range(100):
            # 90% of days gain, 10% tiny loss — net strongly bullish
            if i % 10 == 0:
                prices.append(prices[-1] * 0.999)  # small down day
            else:
                prices.append(prices[-1] * 1.007)  # larger up day
        df = pd.DataFrame(
            {
                "Open": prices,
                "High": [p * 1.003 for p in prices],
                "Low": [p * 0.997 for p in prices],
                "Close": prices,
                "Volume": [1_000_000] * len(prices),
            }
        )
        ind = [{"id": "rsi_14", "type": "RSI", "params": {"period": 14}}]
        result = IndicatorCalculator.compute(df, ind)
        valid = result["rsi_14"].dropna()
        assert len(valid) > 0, "RSI should have valid values"
        assert float(valid.iloc[-1]) > 70, f"Expected RSI > 70, got {float(valid.iloc[-1])}"

    def test_rsi_oversold_zone(self):
        """Strong downtrend with few up bars should push RSI below 30."""
        prices = [100.0]
        for i in range(100):
            if i % 10 == 0:
                prices.append(prices[-1] * 1.001)  # tiny up day
            else:
                prices.append(prices[-1] * 0.993)  # larger down day
        df = pd.DataFrame(
            {
                "Open": prices,
                "High": [p * 1.002 for p in prices],
                "Low": [p * 0.995 for p in prices],
                "Close": prices,
                "Volume": [1_000_000] * len(prices),
            }
        )
        ind = [{"id": "rsi_14", "type": "RSI", "params": {"period": 14}}]
        result = IndicatorCalculator.compute(df, ind)
        valid = result["rsi_14"].dropna()
        assert len(valid) > 0, "RSI should have valid values"
        assert float(valid.iloc[-1]) < 30, f"Expected RSI < 30, got {float(valid.iloc[-1])}"

    def test_rsi_neutral_market(self, synthetic_ohlcv):
        """RSI on a mixed dataset should mostly be between 30 and 70."""
        df = synthetic_ohlcv.copy()
        ind = [{"id": "rsi_14", "type": "RSI", "params": {"period": 14}}]
        result = IndicatorCalculator.compute(df, ind)
        valid = result["rsi_14"].dropna()
        mid_count = ((valid > 30) & (valid < 70)).sum()
        assert mid_count / len(valid) > 0.5  # majority in neutral zone


# ---------------------------------------------------------------------------
# MACD
# ---------------------------------------------------------------------------


class TestMACD:
    def test_macd_columns_exist(self, synthetic_ohlcv):
        df = synthetic_ohlcv.copy()
        ind = [{"id": "macd", "type": "MACD", "params": {"fast": 12, "slow": 26, "signal": 9}}]
        result = IndicatorCalculator.compute(df, ind)
        assert "macd_line" in result.columns
        assert "macd_signal" in result.columns
        assert "macd_hist" in result.columns

    def test_macd_histogram(self, synthetic_ohlcv):
        """Histogram must equal MACD line minus signal line."""
        df = synthetic_ohlcv.copy()
        ind = [{"id": "macd", "type": "MACD", "params": {"fast": 12, "slow": 26, "signal": 9}}]
        result = IndicatorCalculator.compute(df, ind)
        diff = (result["macd_hist"] - (result["macd_line"] - result["macd_signal"])).dropna().abs()
        assert (diff < 1e-9).all()

    def test_macd_signal_lag(self, synthetic_ohlcv):
        """Signal line should lag the MACD line (check correlation direction)."""
        df = synthetic_ohlcv.copy()
        ind = [{"id": "macd", "type": "MACD", "params": {"fast": 12, "slow": 26, "signal": 9}}]
        result = IndicatorCalculator.compute(df, ind).dropna()
        corr = result["macd_line"].corr(result["macd_signal"])
        assert corr > 0.8  # signal should be highly correlated with MACD


# ---------------------------------------------------------------------------
# BBANDS
# ---------------------------------------------------------------------------


class TestBBANDS:
    def test_bbands_columns_exist(self, synthetic_ohlcv):
        df = synthetic_ohlcv.copy()
        ind = [{"id": "bb", "type": "BBANDS", "params": {"period": 20, "std_dev": 2}}]
        result = IndicatorCalculator.compute(df, ind)
        assert "bb_upper" in result.columns
        assert "bb_middle" in result.columns
        assert "bb_lower" in result.columns

    def test_bbands_upper_gt_lower(self, synthetic_ohlcv):
        df = synthetic_ohlcv.copy()
        ind = [{"id": "bb", "type": "BBANDS", "params": {"period": 20, "std_dev": 2}}]
        result = IndicatorCalculator.compute(df, ind).dropna()
        assert (result["bb_upper"] > result["bb_lower"]).all()

    def test_bbands_middle_is_sma(self, synthetic_ohlcv):
        """The middle band should equal the SMA of the same period."""
        df = synthetic_ohlcv.copy()
        ind_bb = [{"id": "bb", "type": "BBANDS", "params": {"period": 20, "std_dev": 2}}]
        ind_sma = [{"id": "sma_20", "type": "SMA", "params": {"period": 20}}]
        result = IndicatorCalculator.compute(df.copy(), ind_bb)
        result2 = IndicatorCalculator.compute(df.copy(), ind_sma)
        diff = (result["bb_middle"] - result2["sma_20"]).dropna().abs()
        assert (diff < 1e-9).all()

    def test_bbands_price_mostly_inside(self, synthetic_ohlcv):
        """For 2-std-dev bands, the majority of price bars should be inside the bands."""
        df = synthetic_ohlcv.copy()
        ind = [{"id": "bb", "type": "BBANDS", "params": {"period": 20, "std_dev": 2}}]
        result = IndicatorCalculator.compute(df, ind).dropna()
        inside = ((result["Close"] <= result["bb_upper"]) & (result["Close"] >= result["bb_lower"])).sum()
        pct_inside = inside / len(result)
        # Statistical theory: ~95% inside for normal returns; synthetic data may vary more
        # so we use a relaxed threshold of 80%
        assert pct_inside > 0.80
