"""
Fundamentals fetcher for StrategyForge.

Pulls a compact fundamentals snapshot from yfinance with a simple
one-hour in-memory cache keyed by ticker.
"""

from __future__ import annotations

import math
import time
from typing import Any

import yfinance as yf

_CACHE_TTL_SECONDS = 3600
_fundamentals_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def _to_number(value: Any) -> float | int | None:
    """Convert a yfinance value to a plain number, or None if unavailable."""
    if value is None:
        return None

    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    if math.isnan(number):
        return None

    if number.is_integer():
        return int(number)
    return number


def _to_optional_str(value: Any) -> str | None:
    """Convert a yfinance value to a string, or None if unavailable."""
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _extract_fundamentals(info: dict[str, Any]) -> dict[str, Any]:
    """Normalize the handful of fundamentals fields used by the API."""
    price = info.get("currentPrice")
    if price is None:
        price = info.get("regularMarketPrice")

    return {
        "price": _to_number(price),
        "pe_ratio": _to_number(info.get("trailingPE")),
        "forward_pe": _to_number(info.get("forwardPE")),
        "peg_ratio": _to_number(info.get("pegRatio")),
        "price_to_sales": _to_number(info.get("priceToSalesTrailing12Months")),
        "ev_to_ebitda": _to_number(info.get("enterpriseToEbitda")),
        "revenue_growth": _to_number(info.get("revenueGrowth")),
        "profit_margins": _to_number(info.get("profitMargins")),
        "operating_margins": _to_number(info.get("operatingMargins")),
        "free_cashflow": _to_number(info.get("freeCashflow")),
        "debt_to_equity": _to_number(info.get("debtToEquity")),
        "week_52_high": _to_number(info.get("fiftyTwoWeekHigh")),
        "week_52_low": _to_number(info.get("fiftyTwoWeekLow")),
        "analyst_target_price": _to_number(info.get("targetMeanPrice")),
        "analyst_recommendation": _to_number(info.get("recommendationMean")),
        "analyst_count": _to_number(info.get("numberOfAnalystOpinions")),
    }


def get_fundamentals(ticker: str) -> dict[str, Any]:
    """
    Return a fundamentals snapshot for a ticker.

    Results are cached in memory for one hour.
    """
    normalized_ticker = str(ticker or "").strip().upper()
    if not normalized_ticker:
        raise ValueError("ticker is required")

    cached = _fundamentals_cache.get(normalized_ticker)
    now = time.time()
    if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
        return cached[1]

    info: dict[str, Any] = {}
    try:
        info = yf.Ticker(normalized_ticker).info or {}
    except Exception:
        info = {}

    payload = {
        "ticker": normalized_ticker,
        "name": _to_optional_str(info.get("shortName") or info.get("longName")) or normalized_ticker,
        "sector": _to_optional_str(info.get("sector")) or "",
        "fundamentals": _extract_fundamentals(info),
    }

    _fundamentals_cache[normalized_ticker] = (now, payload)
    return payload
