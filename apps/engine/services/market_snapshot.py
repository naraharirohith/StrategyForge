"""
Market Snapshot Service for StrategyForge.

Computes a daily-refresh summary of current market conditions:
- Index levels and trends (SPY, NIFTY, etc.)
- VIX / fear-greed indicator
- Sector performance rankings
- Market regime classification
- Hot tickers (momentum leaders)

Used to inject real-time market context into AI strategy generation prompts.
"""

import time
import numpy as np
import pandas as pd
from typing import Optional


# In-memory cache: {market: {data, timestamp}}
_snapshot_cache: dict = {}
SNAPSHOT_TTL = 3600 * 6  # 6 hours


# Index and sector ETF definitions per market
MARKET_CONFIG = {
    "US": {
        "indices": {
            "SPY": "S&P 500",
            "QQQ": "NASDAQ 100",
            "DIA": "Dow Jones",
            "IWM": "Russell 2000",
        },
        "vix_ticker": "^VIX",
        "sectors": {
            "technology": "XLK",
            "healthcare": "XLV",
            "financials": "XLF",
            "energy": "XLE",
            "consumer_discretionary": "XLY",
            "consumer_staples": "XLP",
            "industrials": "XLI",
            "materials": "XLB",
            "real_estate": "XLRE",
            "utilities": "XLU",
            "communication": "XLC",
        },
        "hot_ticker_pool": [
            "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
            "AMD", "NFLX", "CRM", "AVGO", "ORCL", "ADBE",
        ],
    },
    "IN": {
        "indices": {
            "^NSEI": "NIFTY 50",
            "^BSESN": "SENSEX",
        },
        "vix_ticker": "^INDIAVIX",
        "sectors": {
            "banking": "^NSEBANK",
            "it": "^CNXIT",
            "pharma": "^CNXPHARMA",
            "auto": "^CNXAUTO",
            "fmcg": "^CNXFMCG",
            "metal": "^CNXMETAL",
            "realty": "^CNXREALTY",
            "energy": "^CNXENERGY",
        },
        "hot_ticker_pool": [
            "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
            "HINDUNILVR.NS", "ITC.NS", "SBIN.NS", "BHARTIARTL.NS", "KOTAKBANK.NS",
            "LT.NS", "TATAMOTORS.NS", "SUNPHARMA.NS",
        ],
    },
}


class MarketSnapshot:
    """Computes and caches market state snapshots."""

    @staticmethod
    def compute(market: str = "US") -> dict:
        """
        Compute current market snapshot for the given market.

        Returns a dict with: timestamp, market, indices, fear_greed,
        sectors, regime, hot_tickers.

        Results are cached for 6 hours.
        """
        market = market.upper()
        if market not in MARKET_CONFIG:
            market = "US"

        # Check cache
        cached = _snapshot_cache.get(market)
        if cached and (time.time() - cached["timestamp"]) < SNAPSHOT_TTL:
            return cached["data"]

        config = MARKET_CONFIG[market]
        snapshot = {
            "timestamp": pd.Timestamp.now().isoformat(),
            "market": market,
            "indices": _compute_indices(config["indices"]),
            "fear_greed": _compute_fear_greed(config.get("vix_ticker", "^VIX")),
            "sectors": _compute_sectors(config["sectors"]),
            "regime": "unknown",
            "hot_tickers": [],
        }

        # Derive regime from primary index
        primary_index = list(config["indices"].keys())[0]
        index_data = snapshot["indices"].get(primary_index, {})
        snapshot["regime"] = _classify_regime(index_data)

        # Find hot tickers (top movers by 1-month change)
        snapshot["hot_tickers"] = _compute_hot_tickers(config["hot_ticker_pool"])

        # Cache result
        _snapshot_cache[market] = {
            "data": snapshot,
            "timestamp": time.time(),
        }

        return snapshot

    @staticmethod
    def get_prompt_context(market: str = "US") -> str:
        """
        Format the market snapshot as a text block for injection into AI prompts.

        Returns a formatted string like:
        [MARKET CONTEXT - 2026-03-27]
        S&P 500 (SPY): $542.30 (+2.1% this month, BULLISH)
        ...
        """
        try:
            snap = MarketSnapshot.compute(market)
        except Exception as e:
            return f"[MARKET CONTEXT unavailable: {e}]"

        lines = [f"[MARKET CONTEXT - {snap['timestamp'][:10]}]"]

        # Indices
        for ticker, info in snap["indices"].items():
            name = info.get("name", ticker)
            price = info.get("price", "N/A")
            change_1m = info.get("change_1m", 0)
            trend = info.get("trend", "unknown").upper()
            above_200 = "above 200-SMA" if info.get("above_200sma") else "below 200-SMA"
            lines.append(f"{name} ({ticker}): {price} ({change_1m:+.1f}% this month, {above_200}, {trend})")

        # Fear/Greed
        fg = snap["fear_greed"]
        lines.append(f"VIX: {fg.get('vix', 'N/A')} ({fg.get('level', 'unknown').replace('_', ' ')})")

        # Sectors
        sectors = snap["sectors"]
        if sectors:
            sorted_sectors = sorted(sectors.items(), key=lambda x: x[1].get("change_1m", 0), reverse=True)
            hot = [f"{name} {info['change_1m']:+.1f}%" for name, info in sorted_sectors[:3]]
            cold = [f"{name} {info['change_1m']:+.1f}%" for name, info in sorted_sectors[-2:]]
            lines.append(f"Hot sectors: {', '.join(hot)}")
            lines.append(f"Cold sectors: {', '.join(cold)}")

        # Regime
        lines.append(f"Market regime: {snap['regime']}")

        # Hot tickers
        if snap["hot_tickers"]:
            lines.append(f"Momentum leaders: {', '.join(snap['hot_tickers'][:5])}")

        return "\n".join(lines)


def _compute_indices(indices: dict) -> dict:
    """Fetch current price, 1-week/1-month change, trend, 200-SMA status for each index."""
    import yfinance as yf

    result = {}
    for ticker, name in indices.items():
        try:
            data = yf.download(ticker, period="1y", interval="1d", progress=False, auto_adjust=True)
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)
            if data.empty or len(data) < 30:
                result[ticker] = {"name": name, "price": "N/A", "error": "insufficient data"}
                continue

            close = data["Close"]
            current = float(close.iloc[-1])
            sma200 = float(close.rolling(200).mean().iloc[-1]) if len(close) >= 200 else current

            # Changes
            change_1w = 0.0
            if len(close) >= 5:
                change_1w = ((current / float(close.iloc[-5])) - 1) * 100
            change_1m = 0.0
            if len(close) >= 21:
                change_1m = ((current / float(close.iloc[-21])) - 1) * 100

            # Trend classification
            if current > sma200 and change_1m > 2:
                trend = "bullish"
            elif current < sma200 and change_1m < -2:
                trend = "bearish"
            else:
                trend = "sideways"

            result[ticker] = {
                "name": name,
                "price": round(current, 2),
                "change_1w": round(change_1w, 2),
                "change_1m": round(change_1m, 2),
                "trend": trend,
                "above_200sma": current > sma200,
            }
        except Exception as e:
            result[ticker] = {"name": name, "price": "N/A", "error": str(e)}

    return result


def _compute_fear_greed(vix_ticker: str) -> dict:
    """Compute fear/greed level from VIX."""
    import yfinance as yf

    try:
        data = yf.download(vix_ticker, period="1y", interval="1d", progress=False, auto_adjust=True)
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)
        if data.empty:
            return {"vix": "N/A", "level": "unknown", "percentile_1y": 50}

        close = data["Close"]
        current_vix = float(close.iloc[-1])

        # Percentile within last year
        percentile = float((close < current_vix).mean() * 100)

        # Level classification
        if current_vix > 30:
            level = "extreme_fear"
        elif current_vix > 25:
            level = "high_fear"
        elif current_vix > 20:
            level = "moderate_fear"
        elif current_vix > 15:
            level = "low_fear"
        else:
            level = "greed"

        return {
            "vix": round(current_vix, 2),
            "level": level,
            "percentile_1y": round(percentile, 1),
        }
    except Exception as e:
        return {"vix": "N/A", "level": "unknown", "error": str(e)}


def _compute_sectors(sectors: dict) -> dict:
    """Compute 1-month change and rank for each sector ETF/index."""
    import yfinance as yf

    result = {}
    for name, ticker in sectors.items():
        try:
            data = yf.download(ticker, period="60d", interval="1d", progress=False, auto_adjust=True)
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)
            if data.empty or len(data) < 10:
                continue

            close = data["Close"]
            current = float(close.iloc[-1])
            if len(close) >= 21:
                change_1m = ((current / float(close.iloc[-21])) - 1) * 100
            else:
                change_1m = ((current / float(close.iloc[0])) - 1) * 100

            result[name] = {
                "ticker": ticker,
                "change_1m": round(change_1m, 2),
            }
        except Exception:
            continue

    # Add rank
    sorted_sectors = sorted(result.items(), key=lambda x: x[1]["change_1m"], reverse=True)
    for rank, (name, info) in enumerate(sorted_sectors, 1):
        result[name]["rank"] = rank

    return result


def _classify_regime(index_data: dict) -> str:
    """Classify market regime from index data."""
    if not index_data or index_data.get("price") == "N/A":
        return "unknown"

    trend = index_data.get("trend", "unknown")
    change_1m = index_data.get("change_1m", 0)
    above_200 = index_data.get("above_200sma", True)

    if trend == "bullish" and above_200:
        return "bullish_trending"
    elif trend == "bearish" and not above_200:
        return "bearish_trending"
    elif abs(change_1m) < 3:
        return "range_bound"
    elif change_1m > 0:
        return "recovering"
    else:
        return "correcting"


def _compute_hot_tickers(ticker_pool: list, top_n: int = 5) -> list:
    """Find the top movers by 1-month percentage change."""
    import yfinance as yf

    changes = []
    for ticker in ticker_pool:
        try:
            data = yf.download(ticker, period="30d", interval="1d", progress=False, auto_adjust=True)
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)
            if data.empty or len(data) < 5:
                continue
            close = data["Close"]
            change = ((float(close.iloc[-1]) / float(close.iloc[0])) - 1) * 100
            changes.append((ticker, change))
        except Exception:
            continue

    changes.sort(key=lambda x: abs(x[1]), reverse=True)
    return [t[0] for t in changes[:top_n]]
