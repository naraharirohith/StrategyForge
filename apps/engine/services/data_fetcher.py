"""
Data fetching service for StrategyForge backtesting engine.

Implements a fallback chain across multiple data sources:
  1. yfinance (free, broad coverage)
  2. Twelve Data (free tier: 800 req/day, reliable)
  3. Alpha Vantage (free tier: 25 req/day, daily only)

Each fetch is validated for data quality before caching.
Uses a local file-based cache to avoid redundant requests.
"""

from typing import Optional
from services.cache import get_cached, set_cached
from services.data_sources import YFinanceSource, TwelveDataSource, AlphaVantageSource, DataSource
from services.data_validator import validate_ohlcv, DataValidationError


class DataFetcher:
    """Fetches and caches OHLCV data with multi-source fallback."""

    # Ordered fallback chain — tried in sequence until one succeeds
    _sources: list[DataSource] = [
        YFinanceSource(),
        TwelveDataSource(),
        AlphaVantageSource(),
    ]

    @staticmethod
    def fetch(
        ticker: str,
        timeframe: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        force_refresh: bool = False,
    ):
        """
        Fetch OHLCV data for a ticker using fallback chain.

        Tries each data source in order. Validates data quality before caching.

        Args:
            ticker: Stock ticker symbol (e.g. 'AAPL', 'RELIANCE.NS').
            timeframe: One of '5m', '15m', '1h', '4h', '1d', '1w'.
            start_date: Optional start date string (YYYY-MM-DD).
            end_date: Optional end date string (YYYY-MM-DD).
            force_refresh: If True, bypass cache and fetch fresh data.

        Returns:
            pandas DataFrame with columns: Open, High, Low, Close, Volume.

        Raises:
            ValueError: If no source returned valid data.
        """
        # Check cache first
        if not force_refresh:
            try:
                cached = get_cached(ticker, timeframe, start_date, end_date)
                if cached is not None:
                    print(f"Cache hit: {ticker}/{timeframe}")
                    return cached
            except Exception:
                pass  # Cache failure should never block a fetch

        errors = []

        for source in DataFetcher._sources:
            # Skip sources that don't support this timeframe
            if not source.supports_timeframe(timeframe):
                continue

            try:
                print(f"Fetching {ticker}/{timeframe} from {source.name}...")
                raw = source.fetch(ticker, timeframe, start_date, end_date)

                # Validate data quality (auto-fix mode, not strict)
                validated = validate_ohlcv(raw, ticker, timeframe, strict=False)

                # Cache the validated result
                try:
                    set_cached(ticker, timeframe, validated, start_date, end_date)
                except Exception:
                    pass  # Cache failure should never block returning data

                print(f"  -> {source.name}: {len(validated)} bars OK")
                return validated

            except (DataValidationError, ValueError, ImportError) as e:
                errors.append(f"{source.name}: {e}")
                continue
            except Exception as e:
                errors.append(f"{source.name}: {type(e).__name__}: {e}")
                continue

        # All sources failed
        error_summary = "; ".join(errors)
        raise ValueError(
            f"No data source returned valid data for {ticker} ({timeframe}). "
            f"Errors: {error_summary}"
        )

    @staticmethod
    def fetch_multi(
        tickers: list[str],
        timeframe: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        force_refresh: bool = False,
    ) -> dict:
        """
        Fetch OHLCV data for multiple tickers.

        Returns a dict of {ticker: DataFrame} for tickers that succeeded.
        Tickers that fail are silently skipped (logged to console).

        Args:
            tickers: List of ticker symbols.
            timeframe: Timeframe string.
            start_date: Optional start date.
            end_date: Optional end date.
            force_refresh: Bypass cache.

        Returns:
            Dict mapping ticker -> DataFrame. May be empty if all fail.
        """
        results = {}
        for ticker in tickers:
            try:
                df = DataFetcher.fetch(
                    ticker, timeframe, start_date, end_date, force_refresh
                )
                results[ticker] = df
            except Exception as e:
                print(f"Warning: Failed to fetch {ticker}: {e}")
                continue
        return results
