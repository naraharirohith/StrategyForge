"""
Data fetching service for StrategyForge backtesting engine.

Wraps yfinance to fetch and normalize OHLCV data for various timeframes.
Handles MultiIndex columns, resampling (e.g. 1h -> 4h), and date range filtering.
Uses a local file-based cache to avoid redundant yfinance requests.
"""

from services.cache import get_cached, set_cached


class DataFetcher:
    """Fetches and caches OHLCV data from yfinance."""

    TIMEFRAME_MAP = {
        "5m": {"period": "60d", "interval": "5m"},
        "15m": {"period": "60d", "interval": "15m"},
        "1h": {"period": "730d", "interval": "1h"},
        "4h": {"period": "730d", "interval": "1h"},  # fetch 1h and resample
        "1d": {"period": "max", "interval": "1d"},
        "1w": {"period": "max", "interval": "1wk"},
    }

    @staticmethod
    def fetch(ticker: str, timeframe: str, start_date: str = None, end_date: str = None, force_refresh: bool = False):
        """
        Fetch OHLCV data for a ticker.

        Args:
            ticker: Stock ticker symbol (e.g. 'AAPL', 'RELIANCE.NS').
            timeframe: One of '5m', '15m', '1h', '4h', '1d', '1w'.
            start_date: Optional start date string (YYYY-MM-DD).
            end_date: Optional end date string (YYYY-MM-DD).
            force_refresh: If True, bypass cache and fetch fresh data.

        Returns:
            pandas DataFrame with columns: Open, High, Low, Close, Volume.

        Raises:
            ValueError: If no data is returned for the given ticker/timeframe.
        """
        import yfinance as yf
        import pandas as pd

        # Check cache first
        if not force_refresh:
            try:
                cached = get_cached(ticker, timeframe, start_date, end_date)
                if cached is not None:
                    print(f"Cache hit: {ticker}/{timeframe}")
                    return cached
            except Exception:
                pass  # Cache failure should never block a fetch

        tf_config = DataFetcher.TIMEFRAME_MAP.get(timeframe, {"period": "max", "interval": "1d"})

        kwargs = {"interval": tf_config["interval"]}
        if start_date and end_date:
            kwargs["start"] = start_date
            kwargs["end"] = end_date
        else:
            kwargs["period"] = tf_config["period"]

        data = yf.download(ticker, **kwargs, progress=False, auto_adjust=True)

        if data.empty:
            raise ValueError(f"No data returned for {ticker} ({timeframe})")

        # Handle MultiIndex columns from yfinance
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)

        # Ensure standard column names
        data = data.rename(columns={
            "Open": "Open", "High": "High", "Low": "Low",
            "Close": "Close", "Volume": "Volume"
        })

        # Resample 1h -> 4h if needed
        if timeframe == "4h":
            data = data.resample("4h").agg({
                "Open": "first", "High": "max", "Low": "min",
                "Close": "last", "Volume": "sum"
            }).dropna()

        # Cache the result before returning
        try:
            set_cached(ticker, timeframe, data, start_date, end_date)
        except Exception:
            pass  # Cache failure should never block returning data

        return data
