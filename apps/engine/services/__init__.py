"""
StrategyForge engine services package.

Re-exports all service classes and functions for convenient imports.
"""

from .data_fetcher import DataFetcher
from .indicator_calculator import IndicatorCalculator
from .backtester import run_backtest, run_backtest_on_df
from .walk_forward import run_walk_forward
from .score_calculator import ScoreCalculator
from .confidence_scorer import ConfidenceScorer
from .condition_evaluator import (
    evaluate_conditions,
    evaluate_single_condition,
    resolve_value,
    estimate_condition_proximity,
)
from .cache import get_cached, set_cached, clear_cache

__all__ = [
    "DataFetcher",
    "IndicatorCalculator",
    "run_backtest",
    "run_backtest_on_df",
    "run_walk_forward",
    "ScoreCalculator",
    "ConfidenceScorer",
    "evaluate_conditions",
    "evaluate_single_condition",
    "resolve_value",
    "estimate_condition_proximity",
    "get_cached",
    "set_cached",
    "clear_cache",
]
