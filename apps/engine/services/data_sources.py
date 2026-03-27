"""
Data source abstraction for StrategyForge.

Each source implements the same interface: fetch OHLCV data for a ticker+timeframe.
Sources are tried in order until one returns valid data (fallback chain).

Sources:
  1. yfinance (free, broad coverage, sometimes unreliable)
  2. Twelve Data (free tier: 800 req/day, reliable)
  3. Alpha Vantage (free tier: 25 req/day, good for daily)
"""

import os
import abc
import pandas as pd
import numpy as np
from typing import Optional


class DataSource(abc.ABC):
    """Abstract base for OHLCV data sources."""

    name: str = "base"

    @abc.abstractmethod
    def fetch(
        self,
        ticker: str,
        timeframe: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> pd.DataFrame:
        """
        Fetch OHLCV data. Must return a DataFrame with columns:
        Open, High, Low, Close, Volume and a DatetimeIndex.

        Raises Exception on failure (caller handles fallback).
        """
        ...

    def supports_timeframe(self, timeframe: str) -> bool:
        """Whether this source supports the given timeframe."""
        return True


class YFinanceSource(DataSource):
    """Primary source: yfinance (free, broad coverage)."""

    name = "yfinance"

    TIMEFRAME_MAP = {
        "5m": {"period": "60d", "interval": "5m"},
        "15m": {"period": "60d", "interval": "15m"},
        "1h": {"period": "730d", "interval": "1h"},
        "4h": {"period": "730d", "interval": "1h"},  # fetch 1h, resample later
        "1d": {"period": "max", "interval": "1d"},
        "1w": {"period": "max", "interval": "1wk"},
    }

    def fetch(
        self,
        ticker: str,
        timeframe: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> pd.DataFrame:
        import yfinance as yf

        tf_config = self.TIMEFRAME_MAP.get(timeframe, {"period": "max", "interval": "1d"})

        kwargs = {"interval": tf_config["interval"]}
        if start_date and end_date:
            kwargs["start"] = start_date
            kwargs["end"] = end_date
        else:
            kwargs["period"] = tf_config["period"]

        data = yf.download(ticker, **kwargs, progress=False, auto_adjust=True)

        if data.empty:
            raise ValueError(f"yfinance returned no data for {ticker} ({timeframe})")

        # Handle MultiIndex columns
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)

        data = self._normalize_columns(data)

        # Resample 1h -> 4h if needed
        if timeframe == "4h":
            data = data.resample("4h").agg({
                "Open": "first", "High": "max", "Low": "min",
                "Close": "last", "Volume": "sum"
            }).dropna()

        return data

    @staticmethod
    def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
        col_map = {}
        for col in df.columns:
            lower = col.lower()
            if lower == "open": col_map[col] = "Open"
            elif lower == "high": col_map[col] = "High"
            elif lower == "low": col_map[col] = "Low"
            elif lower == "close": col_map[col] = "Close"
            elif lower == "volume": col_map[col] = "Volume"
        if col_map:
            df = df.rename(columns=col_map)
        return df


class TwelveDataSource(DataSource):
    """Fallback source: Twelve Data API (free tier: 800 req/day)."""

    name = "twelvedata"

    TIMEFRAME_MAP = {
        "5m": "5min",
        "15m": "15min",
        "1h": "1h",
        "4h": "4h",
        "1d": "1day",
        "1w": "1week",
    }

    # Approximate output sizes for free tier
    OUTPUT_SIZE = {
        "5m": 5000,
        "15m": 5000,
        "1h": 5000,
        "4h": 5000,
        "1d": 5000,
        "1w": 5000,
    }

    def __init__(self):
        self.api_key = os.environ.get("TWELVE_DATA_API_KEY", "")

    def supports_timeframe(self, timeframe: str) -> bool:
        return timeframe in self.TIMEFRAME_MAP

    def fetch(
        self,
        ticker: str,
        timeframe: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> pd.DataFrame:
        if not self.api_key:
            raise ValueError("TWELVE_DATA_API_KEY not configured")

        try:
            from twelvedata import TDClient
        except ImportError:
            raise ImportError("twelvedata package not installed")

        td = TDClient(apikey=self.api_key)
        interval = self.TIMEFRAME_MAP.get(timeframe, "1day")
        output_size = self.OUTPUT_SIZE.get(timeframe, 5000)

        kwargs = {
            "symbol": self._convert_ticker(ticker),
            "interval": interval,
            "outputsize": output_size,
        }
        if start_date:
            kwargs["start_date"] = start_date
        if end_date:
            kwargs["end_date"] = end_date

        ts = td.time_series(**kwargs)
        df = ts.as_pandas()

        if df is None or df.empty:
            raise ValueError(f"Twelve Data returned no data for {ticker} ({timeframe})")

        # Twelve Data returns newest-first; reverse to chronological
        df = df.sort_index()

        # Normalize column names
        col_map = {}
        for col in df.columns:
            lower = col.lower()
            if lower == "open": col_map[col] = "Open"
            elif lower == "high": col_map[col] = "High"
            elif lower == "low": col_map[col] = "Low"
            elif lower == "close": col_map[col] = "Close"
            elif lower == "volume": col_map[col] = "Volume"
        if col_map:
            df = df.rename(columns=col_map)

        # Ensure numeric types
        for col in ["Open", "High", "Low", "Close", "Volume"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        return df

    @staticmethod
    def _convert_ticker(ticker: str) -> str:
        """Convert yfinance-style tickers to Twelve Data format."""
        # Indian NSE tickers: RELIANCE.NS -> RELIANCE (exchange handled via exchange param)
        if ticker.endswith(".NS") or ticker.endswith(".BO"):
            return ticker  # Twelve Data understands .NS/.BO
        return ticker


class AlphaVantageSource(DataSource):
    """Fallback source: Alpha Vantage (free tier: 25 req/day, daily data only)."""

    name = "alphavantage"

    def __init__(self):
        self.api_key = os.environ.get("ALPHA_VANTAGE_API_KEY", "")

    def supports_timeframe(self, timeframe: str) -> bool:
        # Alpha Vantage free tier is practical only for daily/weekly
        return timeframe in ("1d", "1w")

    def fetch(
        self,
        ticker: str,
        timeframe: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> pd.DataFrame:
        if not self.api_key:
            raise ValueError("ALPHA_VANTAGE_API_KEY not configured")

        import urllib.request
        import json

        # Only daily/weekly supported
        if timeframe == "1w":
            function = "TIME_SERIES_WEEKLY"
            ts_key = "Weekly Time Series"
        else:
            function = "TIME_SERIES_DAILY"
            ts_key = "Time Series (Daily)"

        av_ticker = self._convert_ticker(ticker)
        url = (
            f"https://www.alphavantage.co/query?function={function}"
            f"&symbol={av_ticker}&outputsize=full&apikey={self.api_key}"
        )

        with urllib.request.urlopen(url, timeout=30) as resp:
            raw = json.loads(resp.read().decode())

        if ts_key not in raw:
            error_msg = raw.get("Note", raw.get("Error Message", "Unknown error"))
            raise ValueError(f"Alpha Vantage error for {ticker}: {error_msg}")

        ts_data = raw[ts_key]
        rows = []
        for date_str, values in ts_data.items():
            rows.append({
                "Date": pd.Timestamp(date_str),
                "Open": float(values["1. open"]),
                "High": float(values["2. high"]),
                "Low": float(values["3. low"]),
                "Close": float(values["4. close"]),
                "Volume": float(values["5. volume"]),
            })

        df = pd.DataFrame(rows).set_index("Date").sort_index()

        if df.empty:
            raise ValueError(f"Alpha Vantage returned no data for {ticker}")

        # Filter date range if specified
        if start_date:
            df = df[df.index >= pd.Timestamp(start_date)]
        if end_date:
            df = df[df.index <= pd.Timestamp(end_date)]

        return df

    @staticmethod
    def _convert_ticker(ticker: str) -> str:
        """Convert yfinance-style Indian tickers to Alpha Vantage format."""
        if ticker.endswith(".NS"):
            return ticker.replace(".NS", ".BSE")  # AV uses .BSE for Indian stocks
        return ticker
