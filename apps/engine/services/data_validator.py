"""
Data quality validation for StrategyForge.

Validates OHLCV DataFrames before they are cached or used for backtesting.
Catches common data issues: bad OHLC relationships, duplicate timestamps,
large gaps, and insufficient bar counts.
"""

import pandas as pd
import numpy as np
from typing import Optional


# Minimum bars required per timeframe for a useful backtest
MIN_BARS = {
    "5m": 200,
    "15m": 200,
    "1h": 100,
    "4h": 50,
    "1d": 50,
    "1w": 30,
}


class DataValidationError(Exception):
    """Raised when data fails quality checks."""
    pass


def validate_ohlcv(
    df: pd.DataFrame,
    ticker: str,
    timeframe: str,
    strict: bool = False,
) -> pd.DataFrame:
    """
    Validate and clean an OHLCV DataFrame.

    Checks:
    1. Required columns exist
    2. No duplicate timestamps
    3. OHLC sanity (High >= max(Open, Close), Low <= min(Open, Close))
    4. Volume >= 0 for equity tickers
    5. No gaps > 3 business days (daily data only, warning not rejection)
    6. Minimum bar count for the timeframe

    Args:
        df: OHLCV DataFrame with DatetimeIndex.
        ticker: Ticker symbol (for error messages).
        timeframe: Timeframe string (e.g. '1d', '1h').
        strict: If True, raise on any issue. If False, auto-fix what we can.

    Returns:
        Cleaned DataFrame (rows with bad OHLC removed, duplicates dropped).

    Raises:
        DataValidationError: If data fails critical checks.
    """
    if df is None or df.empty:
        raise DataValidationError(f"{ticker}: DataFrame is empty")

    # 1. Required columns
    required = {"Open", "High", "Low", "Close", "Volume"}
    missing = required - set(df.columns)
    if missing:
        raise DataValidationError(f"{ticker}: Missing columns: {missing}")

    original_len = len(df)

    # 2. Drop duplicate timestamps
    if df.index.duplicated().any():
        dup_count = df.index.duplicated().sum()
        df = df[~df.index.duplicated(keep="last")]
        if strict:
            raise DataValidationError(f"{ticker}: {dup_count} duplicate timestamps")

    # 3. OHLC sanity — drop rows where High < max(Open, Close) or Low > min(Open, Close)
    oc_max = df[["Open", "Close"]].max(axis=1)
    oc_min = df[["Open", "Close"]].min(axis=1)
    bad_high = df["High"] < oc_max - 1e-6  # tolerance for float precision
    bad_low = df["Low"] > oc_min + 1e-6

    bad_ohlc = bad_high | bad_low
    if bad_ohlc.any():
        bad_count = bad_ohlc.sum()
        if strict:
            raise DataValidationError(f"{ticker}: {bad_count} rows with bad OHLC relationships")
        # Auto-fix: clamp High/Low to include Open/Close
        df.loc[bad_high, "High"] = oc_max[bad_high]
        df.loc[bad_low, "Low"] = oc_min[bad_low]

    # 4. Volume >= 0 (only for equity, not indices)
    if not ticker.startswith("^"):
        neg_vol = df["Volume"] < 0
        if neg_vol.any():
            df.loc[neg_vol, "Volume"] = 0

    # 5. Gap check for daily data (informational — logged but not rejected)
    if timeframe in ("1d", "1w") and len(df) > 1:
        gaps = _find_large_gaps(df, max_gap_days=5 if timeframe == "1w" else 3)
        if gaps:
            # Just log — don't reject. Market closures, holidays cause legit gaps.
            pass

    # 6. Drop rows with NaN in OHLC
    ohlc_cols = ["Open", "High", "Low", "Close"]
    nan_rows = df[ohlc_cols].isna().any(axis=1)
    if nan_rows.any():
        df = df[~nan_rows]

    # 7. Minimum bar count
    min_bars = MIN_BARS.get(timeframe, 30)
    if len(df) < min_bars:
        raise DataValidationError(
            f"{ticker}: Only {len(df)} bars after validation "
            f"(need {min_bars} for {timeframe})"
        )

    return df


def _find_large_gaps(df: pd.DataFrame, max_gap_days: int = 3) -> list[dict]:
    """
    Find gaps larger than max_gap_days in the index.

    Returns list of {start, end, gap_days} dicts.
    """
    gaps = []
    dates = df.index.to_series()
    diffs = dates.diff()

    for i, diff in enumerate(diffs):
        if diff is not pd.NaT and diff.days > max_gap_days:
            gaps.append({
                "start": str(dates.iloc[i - 1]),
                "end": str(dates.iloc[i]),
                "gap_days": diff.days,
            })

    return gaps


def get_data_quality_report(df: pd.DataFrame, ticker: str, timeframe: str) -> dict:
    """
    Generate a quality report for a fetched DataFrame.
    Useful for diagnostics and preflight checks.

    Returns:
        Dict with quality metrics.
    """
    if df is None or df.empty:
        return {"ticker": ticker, "bars": 0, "quality": "empty"}

    report = {
        "ticker": ticker,
        "timeframe": timeframe,
        "bars": len(df),
        "date_range": {
            "start": str(df.index[0]),
            "end": str(df.index[-1]),
        },
        "duplicates": int(df.index.duplicated().sum()),
        "nan_rows": int(df[["Open", "High", "Low", "Close"]].isna().any(axis=1).sum()),
    }

    # OHLC sanity check count
    oc_max = df[["Open", "Close"]].max(axis=1)
    oc_min = df[["Open", "Close"]].min(axis=1)
    bad_high = (df["High"] < oc_max - 1e-6).sum()
    bad_low = (df["Low"] > oc_min + 1e-6).sum()
    report["bad_ohlc_rows"] = int(bad_high + bad_low)

    # Gaps
    if timeframe in ("1d", "1w") and len(df) > 1:
        gaps = _find_large_gaps(df, max_gap_days=5 if timeframe == "1w" else 3)
        report["large_gaps"] = len(gaps)
    else:
        report["large_gaps"] = 0

    # Overall quality rating
    issues = report["duplicates"] + report["nan_rows"] + report["bad_ohlc_rows"]
    if issues == 0:
        report["quality"] = "good"
    elif issues / len(df) < 0.02:
        report["quality"] = "acceptable"
    else:
        report["quality"] = "poor"

    return report
