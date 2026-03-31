"""
StrategyForge engine services package.

Re-exports all service classes and functions for convenient imports.
"""

from .data_fetcher import DataFetcher
from .data_sources import DataSource, YFinanceSource, TwelveDataSource, AlphaVantageSource
from .data_validator import validate_ohlcv, DataValidationError, get_data_quality_report
from .indicator_calculator import IndicatorCalculator
from .backtester import run_backtest, run_backtest_on_df, run_backtest_multi
from .asset_universe import ASSET_UNIVERSE, resolve_tickers
from .news_fetcher import NewsFetcher
from .walk_forward import run_walk_forward
from .score_calculator import ScoreCalculator
from .confidence_scorer import ConfidenceScorer
from .condition_evaluator import (
    evaluate_conditions,
    evaluate_single_condition,
    resolve_value,
    estimate_condition_proximity,
    collect_condition_stats,
)
from .market_snapshot import MarketSnapshot
from .cache import get_cached, set_cached, clear_cache
from .strategy_templates import get_template, get_template_list, customize_template

__all__ = [
    "DataFetcher",
    "DataSource",
    "YFinanceSource",
    "TwelveDataSource",
    "AlphaVantageSource",
    "validate_ohlcv",
    "DataValidationError",
    "get_data_quality_report",
    "IndicatorCalculator",
    "run_backtest",
    "run_backtest_on_df",
    "run_backtest_multi",
    "ASSET_UNIVERSE",
    "resolve_tickers",
    "NewsFetcher",
    "run_walk_forward",
    "ScoreCalculator",
    "ConfidenceScorer",
    "evaluate_conditions",
    "evaluate_single_condition",
    "resolve_value",
    "estimate_condition_proximity",
    "collect_condition_stats",
    "MarketSnapshot",
    "get_cached",
    "set_cached",
    "clear_cache",
    "get_template",
    "get_template_list",
    "customize_template",
]
