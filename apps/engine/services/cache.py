"""
Local file-based OHLCV cache.

Caches yfinance data as pickle files under .cache/ directory.
Cache policy:
  - Daily/weekly data: valid for 1 hour
  - Intraday data (5m, 15m, 1h, 4h): valid for 5 minutes
  - Force refresh bypasses cache
"""

import time
import hashlib
import pandas as pd
from pathlib import Path

CACHE_DIR = Path(__file__).parent.parent / ".cache"

# Max age in seconds
CACHE_TTL = {
    "5m": 300,      # 5 minutes
    "15m": 300,
    "1h": 300,
    "4h": 300,
    "1d": 3600,     # 1 hour
    "1w": 3600,
}


def _cache_key(ticker: str, timeframe: str, start_date: str = None, end_date: str = None) -> str:
    """Generate a unique cache filename for a ticker+timeframe+date range."""
    parts = [ticker.replace("^", "IDX_").replace(".", "_"), timeframe]
    if start_date:
        parts.append(start_date)
    if end_date:
        parts.append(end_date)
    key = "_".join(parts)
    return hashlib.md5(key.encode()).hexdigest()[:12] + f"_{ticker.replace('^', '').replace('.', '_')}_{timeframe}"


def get_cached(ticker: str, timeframe: str, start_date: str = None, end_date: str = None) -> pd.DataFrame | None:
    """
    Return cached DataFrame if it exists and is fresh enough.
    Returns None if cache miss or stale.
    """
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = _cache_key(ticker, timeframe, start_date, end_date)
    path = CACHE_DIR / f"{key}.pkl"

    if not path.exists():
        return None

    # Check age
    age = time.time() - path.stat().st_mtime
    ttl = CACHE_TTL.get(timeframe, 3600)

    if age > ttl:
        return None  # stale

    try:
        df = pd.read_pickle(path)
        if df.empty:
            return None
        return df
    except Exception:
        return None


def set_cached(ticker: str, timeframe: str, df: pd.DataFrame, start_date: str = None, end_date: str = None) -> None:
    """Save a DataFrame to cache."""
    if df is None or df.empty:
        return

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = _cache_key(ticker, timeframe, start_date, end_date)
    path = CACHE_DIR / f"{key}.pkl"

    try:
        df.to_pickle(path)
    except Exception as e:
        print(f"Cache write failed for {ticker}/{timeframe}: {e}")


def clear_cache() -> int:
    """Remove all cached files. Returns number of files deleted."""
    if not CACHE_DIR.exists():
        return 0
    count = 0
    for f in CACHE_DIR.glob("*.pkl"):
        f.unlink()
        count += 1
    return count
