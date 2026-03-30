"""
Stock screener: returns top stocks per sector ranked by momentum.

Fetches OHLCV + basic fundamentals via yfinance, ranks by 1-month return,
adds MA trend context and P/E. Results cached 1 hour.
"""
from __future__ import annotations
import time
import yfinance as yf
import pandas as pd
import numpy as np

# 1-hour cache
_screener_cache: dict[tuple[str, str], dict] = {}
CACHE_TTL = 3600

# Sector → ticker mapping per market
# US sectors use ETF proxies + top individual stocks
# IN sectors use NSE tickers (.NS suffix)
# CRYPTO sectors by category
SECTOR_TICKERS: dict[str, dict[str, list[str]]] = {
    "US": {
        "technology": ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMD", "ORCL", "CRM", "ADBE", "INTC"],
        "healthcare": ["UNH", "JNJ", "LLY", "ABBV", "MRK", "TMO", "ABT", "DHR", "BMY", "AMGN"],
        "financials": ["JPM", "BAC", "WFC", "GS", "MS", "BLK", "C", "AXP", "COF", "USB"],
        "energy": ["XOM", "CVX", "COP", "EOG", "SLB", "MPC", "PSX", "VLO", "HAL", "OXY"],
        "consumer": ["AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX", "TGT", "COST", "WMT", "LOW"],
        "industrials": ["CAT", "DE", "BA", "HON", "UPS", "FDX", "LMT", "RTX", "GE", "MMM"],
        "utilities": ["NEE", "DUK", "SO", "D", "AEP", "EXC", "SRE", "PEG", "ED", "XEL"],
        "realty": ["AMT", "PLD", "CCI", "EQIX", "PSA", "O", "DLR", "WELL", "SPG", "AVB"],
    },
    "IN": {
        "it": ["TCS.NS", "INFY.NS", "WIPRO.NS", "HCLTECH.NS", "TECHM.NS", "LTI.NS", "MPHASIS.NS", "COFORGE.NS"],
        "banking": ["HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS", "KOTAKBANK.NS", "AXISBANK.NS", "INDUSINDBK.NS", "BANDHANBNK.NS"],
        "pharma": ["SUNPHARMA.NS", "DRREDDY.NS", "CIPLA.NS", "DIVISLAB.NS", "BIOCON.NS", "AUROPHARMA.NS", "TORNTPHARM.NS"],
        "energy": ["RELIANCE.NS", "ONGC.NS", "NTPC.NS", "POWERGRID.NS", "BPCL.NS", "IOC.NS", "GAIL.NS"],
        "auto": ["TATAMOTORS.NS", "MARUTI.NS", "M&M.NS", "BAJAJ-AUTO.NS", "HEROMOTOCO.NS", "EICHERMOT.NS"],
        "fmcg": ["HINDUNILVR.NS", "ITC.NS", "NESTLEIND.NS", "BRITANNIA.NS", "DABUR.NS", "MARICO.NS", "GODREJCP.NS"],
        "realty": ["DLF.NS", "GODREJPROP.NS", "OBEROIRLTY.NS", "PHOENIXLTD.NS", "PRESTIGE.NS"],
        "metals": ["TATASTEEL.NS", "HINDALCO.NS", "JSWSTEEL.NS", "SAIL.NS", "VEDL.NS", "NMDC.NS"],
    },
    "CRYPTO": {
        "layer1": ["BTC-USD", "ETH-USD", "SOL-USD", "AVAX-USD", "ADA-USD", "DOT-USD"],
        "defi": ["UNI-USD", "AAVE-USD", "MKR-USD", "CRV-USD", "COMP-USD", "SNX-USD"],
        "layer2": ["MATIC-USD", "ARB-USD", "OP-USD", "LRC-USD"],
        "exchange": ["BNB-USD", "OKB-USD", "CRO-USD"],
        "gaming": ["AXS-USD", "SAND-USD", "MANA-USD", "ENJ-USD", "GALA-USD"],
    },
}


def screen_sector(market: str, sector: str, limit: int = 10) -> list[dict]:
    """
    Return top stocks in sector ranked by 1-month return.

    Each entry has: ticker, price, return_1m, return_3m,
    above_ema20, above_ema50, above_ema200, pct_from_52w_high,
    pe_ratio, trend, currency.
    """
    market = market.upper()
    sector = sector.lower()
    cache_key = (market, sector)

    cached = _screener_cache.get(cache_key)
    if cached and (time.time() - cached["timestamp"]) < CACHE_TTL:
        return cached["data"][:limit]

    tickers = SECTOR_TICKERS.get(market, {}).get(sector, [])
    if not tickers:
        return []

    results = []
    for ticker in tickers:
        try:
            row = _fetch_stock_metrics(ticker, market)
            if row:
                results.append(row)
        except Exception:
            continue

    # Rank by 1-month return descending (None values sort last)
    results.sort(key=lambda x: x.get("return_1m") if x.get("return_1m") is not None else -999, reverse=True)

    _screener_cache[cache_key] = {"data": results, "timestamp": time.time()}
    return results[:limit]


def _fetch_stock_metrics(ticker: str, market: str) -> dict | None:
    """Fetch metrics for a single ticker via yfinance."""
    currency = "INR" if market == "IN" else "USD"

    tk = yf.Ticker(ticker)
    # Fetch 1 year of daily data for returns + MA calculation
    hist = tk.history(period="1y", interval="1d", auto_adjust=True)
    if hist.empty or len(hist) < 20:
        return None

    close = hist["Close"]
    current_price = float(close.iloc[-1])

    # Returns
    ret_1m = _pct_change(close, 21)
    ret_3m = _pct_change(close, 63)

    # Moving averages
    ema20 = float(close.ewm(span=20).mean().iloc[-1])
    ema50 = float(close.ewm(span=50).mean().iloc[-1]) if len(close) >= 50 else None
    ema200 = float(close.ewm(span=200).mean().iloc[-1]) if len(close) >= 200 else None

    # 52-week high/low
    high_52w = float(close.max())
    pct_from_52w_high = ((current_price - high_52w) / high_52w) * 100

    # Trend classification
    trend = _classify_trend(current_price, ema20, ema50, ema200)

    # P/E ratio (best-effort — may be None)
    pe_ratio = None
    if market != "CRYPTO":
        try:
            info = tk.fast_info
            pe_ratio = getattr(info, "pe_ratio", None)
            if pe_ratio is not None:
                pe_ratio = round(float(pe_ratio), 1)
        except Exception:
            pe_ratio = None

    return {
        "ticker": ticker,
        "price": round(current_price, 2),
        "return_1m": round(ret_1m, 2) if ret_1m is not None else None,
        "return_3m": round(ret_3m, 2) if ret_3m is not None else None,
        "above_ema20": current_price > ema20,
        "above_ema50": current_price > ema50 if ema50 is not None else None,
        "above_ema200": current_price > ema200 if ema200 is not None else None,
        "pct_from_52w_high": round(pct_from_52w_high, 1),
        "pe_ratio": pe_ratio,
        "trend": trend,
        "currency": currency,
    }


def _pct_change(series: pd.Series, bars: int) -> float | None:
    """Compute percentage change over the last `bars` periods."""
    if len(series) < bars + 1:
        return None
    old = float(series.iloc[-bars - 1])
    new = float(series.iloc[-1])
    if old == 0:
        return None
    return ((new - old) / old) * 100


def _classify_trend(price: float, ema20: float, ema50: float | None, ema200: float | None) -> str:
    """Classify trend as bullish, bearish, or sideways based on MA alignment."""
    score = 0
    if price > ema20:
        score += 1
    if ema50 and price > ema50:
        score += 1
    if ema200 and price > ema200:
        score += 1
    if score >= 2:
        return "bullish"
    if score == 0:
        return "bearish"
    return "sideways"
