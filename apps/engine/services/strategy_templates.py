"""
Strategy Templates — Phase 3.2

Pre-validated StrategyDefinition JSONs for Simple Mode.
Each template is a complete, backtestable strategy that maps to a common user intent.

The AI can customize tickers, thresholds, and position sizing based on user context.
"""

from typing import Any

STRATEGY_TEMPLATES: dict[str, dict[str, Any]] = {
    "recession_shield": {
        "schema_version": "1.0.0",
        "name": "Recession Shield",
        "description": "A defensive strategy designed to protect capital during market downturns. Uses low-volatility ETFs with trend-following signals to stay invested during uptrends and move to cash during bear markets. Conservative risk with tight stops.",
        "style": "positional",
        "risk_level": "conservative",
        "universe": {
            "market": "US",
            "asset_class": "etf",
            "tickers": ["USMV", "SPLV", "GLD", "TLT"],
        },
        "timeframe": "1d",
        "indicators": [
            {"id": "ema_50", "type": "EMA", "params": {"period": 50}},
            {"id": "ema_200", "type": "EMA", "params": {"period": 200}},
            {"id": "rsi_14", "type": "RSI", "params": {"period": 14}},
            {"id": "atr_14", "type": "ATR", "params": {"period": 14}},
        ],
        "entry_rules": [
            {
                "id": "e1",
                "name": "Defensive Entry",
                "side": "long",
                "conditions": {
                    "logic": "AND",
                    "conditions": [
                        {"id": "c1", "left": {"type": "indicator", "indicator_id": "ema_50"}, "operator": "gt", "right": {"type": "indicator", "indicator_id": "ema_200"}},
                        {"id": "c2", "left": {"type": "indicator", "indicator_id": "rsi_14"}, "operator": "lt", "right": {"type": "constant", "value": 65}},
                        {"id": "c3", "left": {"type": "indicator", "indicator_id": "rsi_14"}, "operator": "gt", "right": {"type": "constant", "value": 30}},
                    ],
                },
                "position_sizing": {"method": "percent_of_portfolio", "percent": 15},
                "cooldown_bars": 5,
            }
        ],
        "exit_rules": [
            {"id": "x1", "name": "Stop Loss", "type": "stop_loss", "value": 3, "priority": 1},
            {"id": "x2", "name": "Take Profit", "type": "take_profit", "value": 10, "priority": 2},
            {"id": "x3", "name": "Trailing Stop", "type": "trailing_stop", "value": 5, "priority": 3},
        ],
        "risk_management": {
            "max_portfolio_drawdown_percent": 10,
            "max_position_count": 4,
        },
        "backtest_config": {
            "initial_capital": 100000,
            "currency": "USD",
            "commission_percent": 0.1,
            "slippage_percent": 0.05,
        },
    },
    "balanced_growth": {
        "schema_version": "1.0.0",
        "name": "Balanced Growth",
        "description": "A steady growth strategy combining trend-following with momentum confirmation across diversified large-cap stocks. Aims for consistent returns with moderate drawdowns.",
        "style": "swing",
        "risk_level": "moderate",
        "universe": {
            "market": "US",
            "asset_class": "equity",
            "tickers": ["AAPL", "MSFT", "GOOGL", "JPM", "JNJ"],
        },
        "timeframe": "1d",
        "indicators": [
            {"id": "ema_20", "type": "EMA", "params": {"period": 20}},
            {"id": "ema_50", "type": "EMA", "params": {"period": 50}},
            {"id": "rsi_14", "type": "RSI", "params": {"period": 14}},
            {"id": "macd", "type": "MACD", "params": {"fast": 12, "slow": 26, "signal": 9}},
        ],
        "entry_rules": [
            {
                "id": "e1",
                "name": "Trend + Momentum Entry",
                "side": "long",
                "conditions": {
                    "logic": "AND",
                    "conditions": [
                        {"id": "c1", "left": {"type": "indicator", "indicator_id": "ema_20"}, "operator": "gt", "right": {"type": "indicator", "indicator_id": "ema_50"}},
                        {"id": "c2", "left": {"type": "indicator", "indicator_id": "rsi_14"}, "operator": "gt", "right": {"type": "constant", "value": 40}},
                        {"id": "c3", "left": {"type": "indicator", "indicator_id": "rsi_14"}, "operator": "lt", "right": {"type": "constant", "value": 65}},
                    ],
                },
                "position_sizing": {"method": "percent_of_portfolio", "percent": 15},
                "cooldown_bars": 3,
            }
        ],
        "exit_rules": [
            {"id": "x1", "name": "Stop Loss", "type": "stop_loss", "value": 5, "priority": 1},
            {"id": "x2", "name": "Take Profit", "type": "take_profit", "value": 12, "priority": 2},
            {"id": "x3", "name": "Trailing Stop", "type": "trailing_stop", "value": 7, "priority": 3},
        ],
        "risk_management": {
            "max_portfolio_drawdown_percent": 15,
            "max_position_count": 5,
        },
        "backtest_config": {
            "initial_capital": 100000,
            "currency": "USD",
            "commission_percent": 0.1,
            "slippage_percent": 0.05,
        },
    },
    "momentum_rider": {
        "schema_version": "1.0.0",
        "name": "Momentum Rider",
        "description": "An aggressive momentum strategy targeting high-growth stocks with strong trend confirmation. Uses ADX for trend strength and RSI for momentum timing. Higher risk with larger position sizes for potentially higher returns.",
        "style": "momentum",
        "risk_level": "aggressive",
        "universe": {
            "market": "US",
            "asset_class": "equity",
            "tickers": ["NVDA", "TSLA", "META", "AMD", "AMZN"],
        },
        "timeframe": "1d",
        "indicators": [
            {"id": "ema_20", "type": "EMA", "params": {"period": 20}},
            {"id": "ema_50", "type": "EMA", "params": {"period": 50}},
            {"id": "rsi_14", "type": "RSI", "params": {"period": 14}},
            {"id": "adx_14", "type": "ADX", "params": {"period": 14}},
        ],
        "entry_rules": [
            {
                "id": "e1",
                "name": "Strong Momentum Entry",
                "side": "long",
                "conditions": {
                    "logic": "AND",
                    "conditions": [
                        {"id": "c1", "left": {"type": "indicator", "indicator_id": "ema_20"}, "operator": "gt", "right": {"type": "indicator", "indicator_id": "ema_50"}},
                        {"id": "c2", "left": {"type": "indicator", "indicator_id": "adx_14"}, "operator": "gt", "right": {"type": "constant", "value": 25}},
                        {"id": "c3", "left": {"type": "indicator", "indicator_id": "rsi_14"}, "operator": "gt", "right": {"type": "constant", "value": 50}},
                        {"id": "c4", "left": {"type": "indicator", "indicator_id": "rsi_14"}, "operator": "lt", "right": {"type": "constant", "value": 75}},
                    ],
                },
                "position_sizing": {"method": "percent_of_portfolio", "percent": 20},
                "cooldown_bars": 2,
            }
        ],
        "exit_rules": [
            {"id": "x1", "name": "Stop Loss", "type": "stop_loss", "value": 8, "priority": 1},
            {"id": "x2", "name": "Take Profit", "type": "take_profit", "value": 20, "priority": 2},
            {"id": "x3", "name": "Trailing Stop", "type": "trailing_stop", "value": 10, "priority": 3},
        ],
        "risk_management": {
            "max_portfolio_drawdown_percent": 20,
            "max_position_count": 5,
        },
        "backtest_config": {
            "initial_capital": 100000,
            "currency": "USD",
            "commission_percent": 0.1,
            "slippage_percent": 0.05,
        },
    },
    "dividend_harvester": {
        "schema_version": "1.0.0",
        "name": "Dividend Harvester",
        "description": "A conservative income strategy focusing on high-dividend-yield stocks with trend confirmation. Enters when stocks show stable uptrends and holds for dividend income plus moderate capital appreciation.",
        "style": "positional",
        "risk_level": "conservative",
        "universe": {
            "market": "US",
            "asset_class": "etf",
            "tickers": ["VYM", "SCHD", "DVY", "HDV"],
        },
        "timeframe": "1d",
        "indicators": [
            {"id": "ema_50", "type": "EMA", "params": {"period": 50}},
            {"id": "ema_200", "type": "EMA", "params": {"period": 200}},
            {"id": "rsi_14", "type": "RSI", "params": {"period": 14}},
        ],
        "entry_rules": [
            {
                "id": "e1",
                "name": "Dividend Buy",
                "side": "long",
                "conditions": {
                    "logic": "AND",
                    "conditions": [
                        {"id": "c1", "left": {"type": "price", "field": "close"}, "operator": "gt", "right": {"type": "indicator", "indicator_id": "ema_200"}},
                        {"id": "c2", "left": {"type": "indicator", "indicator_id": "rsi_14"}, "operator": "lt", "right": {"type": "constant", "value": 55}},
                        {"id": "c3", "left": {"type": "indicator", "indicator_id": "rsi_14"}, "operator": "gt", "right": {"type": "constant", "value": 25}},
                    ],
                },
                "position_sizing": {"method": "percent_of_portfolio", "percent": 20},
                "cooldown_bars": 10,
            }
        ],
        "exit_rules": [
            {"id": "x1", "name": "Stop Loss", "type": "stop_loss", "value": 4, "priority": 1},
            {"id": "x2", "name": "Take Profit", "type": "take_profit", "value": 15, "priority": 2},
            {"id": "x3", "name": "Time Exit", "type": "time_based", "value": 60, "priority": 3},
        ],
        "risk_management": {
            "max_portfolio_drawdown_percent": 10,
            "max_position_count": 4,
        },
        "backtest_config": {
            "initial_capital": 100000,
            "currency": "USD",
            "commission_percent": 0.1,
            "slippage_percent": 0.05,
        },
    },
    "dip_buyer": {
        "schema_version": "1.0.0",
        "name": "Dip Buyer",
        "description": "A mean-reversion strategy that buys quality large-cap stocks on significant dips. Enters when RSI signals oversold conditions while the broader trend remains intact. Conservative stops with moderate profit targets.",
        "style": "mean_reversion",
        "risk_level": "moderate",
        "universe": {
            "market": "US",
            "asset_class": "equity",
            "tickers": ["AAPL", "MSFT", "GOOGL", "AMZN", "META"],
        },
        "timeframe": "1d",
        "indicators": [
            {"id": "rsi_14", "type": "RSI", "params": {"period": 14}},
            {"id": "ema_50", "type": "EMA", "params": {"period": 50}},
            {"id": "bbands", "type": "BBANDS", "params": {"period": 20, "std_dev": 2}},
        ],
        "entry_rules": [
            {
                "id": "e1",
                "name": "Oversold Dip Entry",
                "side": "long",
                "conditions": {
                    "logic": "AND",
                    "conditions": [
                        {"id": "c1", "left": {"type": "indicator", "indicator_id": "rsi_14"}, "operator": "lt", "right": {"type": "constant", "value": 30}},
                        {"id": "c2", "left": {"type": "price", "field": "close"}, "operator": "gt", "right": {"type": "indicator", "indicator_id": "ema_50"}},
                    ],
                },
                "position_sizing": {"method": "percent_of_portfolio", "percent": 15},
                "cooldown_bars": 5,
            }
        ],
        "exit_rules": [
            {"id": "x1", "name": "Stop Loss", "type": "stop_loss", "value": 4, "priority": 1},
            {"id": "x2", "name": "Take Profit", "type": "take_profit", "value": 10, "priority": 2},
            {"id": "x3", "name": "Trailing Stop", "type": "trailing_stop", "value": 6, "priority": 3},
        ],
        "risk_management": {
            "max_portfolio_drawdown_percent": 12,
            "max_position_count": 5,
        },
        "backtest_config": {
            "initial_capital": 100000,
            "currency": "USD",
            "commission_percent": 0.1,
            "slippage_percent": 0.05,
        },
    },
    "gold_safe_haven": {
        "schema_version": "1.0.0",
        "name": "Gold Safe Haven",
        "description": "A safe-haven strategy using gold ETFs for capital preservation during uncertainty. Follows gold's trend with conservative entry signals and tight risk management.",
        "style": "positional",
        "risk_level": "conservative",
        "universe": {
            "market": "US",
            "asset_class": "etf",
            "tickers": ["GLD", "IAU"],
        },
        "timeframe": "1d",
        "indicators": [
            {"id": "ema_20", "type": "EMA", "params": {"period": 20}},
            {"id": "ema_50", "type": "EMA", "params": {"period": 50}},
            {"id": "rsi_14", "type": "RSI", "params": {"period": 14}},
            {"id": "atr_14", "type": "ATR", "params": {"period": 14}},
        ],
        "entry_rules": [
            {
                "id": "e1",
                "name": "Gold Trend Entry",
                "side": "long",
                "conditions": {
                    "logic": "AND",
                    "conditions": [
                        {"id": "c1", "left": {"type": "indicator", "indicator_id": "ema_20"}, "operator": "gt", "right": {"type": "indicator", "indicator_id": "ema_50"}},
                        {"id": "c2", "left": {"type": "indicator", "indicator_id": "rsi_14"}, "operator": "gt", "right": {"type": "constant", "value": 35}},
                        {"id": "c3", "left": {"type": "indicator", "indicator_id": "rsi_14"}, "operator": "lt", "right": {"type": "constant", "value": 65}},
                    ],
                },
                "position_sizing": {"method": "percent_of_portfolio", "percent": 25},
                "cooldown_bars": 5,
            }
        ],
        "exit_rules": [
            {"id": "x1", "name": "Stop Loss", "type": "stop_loss", "value": 3, "priority": 1},
            {"id": "x2", "name": "Take Profit", "type": "take_profit", "value": 12, "priority": 2},
            {"id": "x3", "name": "Trailing Stop", "type": "trailing_stop", "value": 5, "priority": 3},
        ],
        "risk_management": {
            "max_portfolio_drawdown_percent": 8,
            "max_position_count": 2,
        },
        "backtest_config": {
            "initial_capital": 100000,
            "currency": "USD",
            "commission_percent": 0.1,
            "slippage_percent": 0.05,
        },
    },
    "all_weather": {
        "schema_version": "1.0.0",
        "name": "All-Weather Portfolio",
        "description": "A diversified multi-asset strategy inspired by risk-parity principles. Allocates across stocks, bonds, gold, and real estate ETFs with trend-following entry signals to reduce drawdowns.",
        "style": "portfolio",
        "risk_level": "conservative",
        "universe": {
            "market": "US",
            "asset_class": "etf",
            "tickers": ["SPY", "TLT", "GLD", "VNQ"],
        },
        "timeframe": "1d",
        "indicators": [
            {"id": "ema_50", "type": "EMA", "params": {"period": 50}},
            {"id": "ema_200", "type": "EMA", "params": {"period": 200}},
            {"id": "rsi_14", "type": "RSI", "params": {"period": 14}},
        ],
        "entry_rules": [
            {
                "id": "e1",
                "name": "Trend Allocation Entry",
                "side": "long",
                "conditions": {
                    "logic": "AND",
                    "conditions": [
                        {"id": "c1", "left": {"type": "price", "field": "close"}, "operator": "gt", "right": {"type": "indicator", "indicator_id": "ema_50"}},
                        {"id": "c2", "left": {"type": "indicator", "indicator_id": "rsi_14"}, "operator": "lt", "right": {"type": "constant", "value": 70}},
                    ],
                },
                "position_sizing": {"method": "percent_of_portfolio", "percent": 20},
                "cooldown_bars": 10,
            }
        ],
        "exit_rules": [
            {"id": "x1", "name": "Stop Loss", "type": "stop_loss", "value": 5, "priority": 1},
            {"id": "x2", "name": "Take Profit", "type": "take_profit", "value": 15, "priority": 2},
            {"id": "x3", "name": "Time Exit", "type": "time_based", "value": 60, "priority": 3},
        ],
        "risk_management": {
            "max_portfolio_drawdown_percent": 12,
            "max_position_count": 4,
        },
        "backtest_config": {
            "initial_capital": 100000,
            "currency": "USD",
            "commission_percent": 0.1,
            "slippage_percent": 0.05,
        },
    },
    "nifty_momentum": {
        "schema_version": "1.0.0",
        "name": "NIFTY Momentum",
        "description": "A momentum strategy for top Indian NIFTY50 stocks using Supertrend and ADX for trend confirmation. Enters when stocks show strong directional movement with moderate risk management.",
        "style": "momentum",
        "risk_level": "moderate",
        "universe": {
            "market": "IN",
            "asset_class": "equity",
            "tickers": ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS"],
        },
        "timeframe": "1d",
        "indicators": [
            {"id": "supertrend", "type": "SUPERTREND", "params": {"period": 10, "multiplier": 3}},
            {"id": "ema_50", "type": "EMA", "params": {"period": 50}},
            {"id": "adx_14", "type": "ADX", "params": {"period": 14}},
            {"id": "rsi_14", "type": "RSI", "params": {"period": 14}},
        ],
        "entry_rules": [
            {
                "id": "e1",
                "name": "NIFTY Momentum Entry",
                "side": "long",
                "conditions": {
                    "logic": "AND",
                    "conditions": [
                        {"id": "c1", "left": {"type": "price", "field": "close"}, "operator": "gt", "right": {"type": "indicator", "indicator_id": "ema_50"}},
                        {"id": "c2", "left": {"type": "indicator", "indicator_id": "adx_14"}, "operator": "gt", "right": {"type": "constant", "value": 20}},
                        {"id": "c3", "left": {"type": "indicator", "indicator_id": "rsi_14"}, "operator": "gt", "right": {"type": "constant", "value": 40}},
                        {"id": "c4", "left": {"type": "indicator", "indicator_id": "rsi_14"}, "operator": "lt", "right": {"type": "constant", "value": 70}},
                    ],
                },
                "position_sizing": {"method": "percent_of_portfolio", "percent": 15},
                "cooldown_bars": 3,
            }
        ],
        "exit_rules": [
            {"id": "x1", "name": "Stop Loss", "type": "stop_loss", "value": 5, "priority": 1},
            {"id": "x2", "name": "Take Profit", "type": "take_profit", "value": 15, "priority": 2},
            {"id": "x3", "name": "Trailing Stop", "type": "trailing_stop", "value": 8, "priority": 3},
        ],
        "risk_management": {
            "max_portfolio_drawdown_percent": 15,
            "max_position_count": 5,
        },
        "backtest_config": {
            "initial_capital": 500000,
            "currency": "INR",
            "commission_percent": 0.03,
            "slippage_percent": 0.1,
        },
    },
}

# Template metadata for frontend display
TEMPLATE_INFO: list[dict[str, str]] = [
    {
        "id": "recession_shield",
        "name": "Recession Shield",
        "description": "Protect your capital during market downturns",
        "risk": "low",
        "market": "US",
        "icon": "shield",
    },
    {
        "id": "balanced_growth",
        "name": "Balanced Growth",
        "description": "Steady growth with diversified large caps",
        "risk": "moderate",
        "market": "US",
        "icon": "trending_up",
    },
    {
        "id": "momentum_rider",
        "name": "Momentum Rider",
        "description": "Ride strong trends in high-growth stocks",
        "risk": "high",
        "market": "US",
        "icon": "rocket",
    },
    {
        "id": "dividend_harvester",
        "name": "Dividend Harvester",
        "description": "Income from high-dividend ETFs",
        "risk": "low",
        "market": "US",
        "icon": "payments",
    },
    {
        "id": "dip_buyer",
        "name": "Dip Buyer",
        "description": "Buy quality stocks on significant pullbacks",
        "risk": "moderate",
        "market": "US",
        "icon": "south_west",
    },
    {
        "id": "gold_safe_haven",
        "name": "Gold Safe Haven",
        "description": "Capital preservation through gold",
        "risk": "low",
        "market": "US",
        "icon": "diamond",
    },
    {
        "id": "all_weather",
        "name": "All-Weather",
        "description": "Diversified across stocks, bonds, gold, real estate",
        "risk": "low",
        "market": "US",
        "icon": "umbrella",
    },
    {
        "id": "nifty_momentum",
        "name": "NIFTY Momentum",
        "description": "Ride momentum in top Indian stocks",
        "risk": "moderate",
        "market": "IN",
        "icon": "trending_up",
    },
]


def get_template(template_id: str) -> dict[str, Any] | None:
    """Get a strategy template by ID."""
    return STRATEGY_TEMPLATES.get(template_id)


def get_template_list() -> list[dict[str, str]]:
    """Get list of available templates with metadata."""
    return TEMPLATE_INFO


def customize_template(
    template_id: str,
    market: str | None = None,
    capital: float | None = None,
    currency: str | None = None,
    tickers: list[str] | None = None,
) -> dict[str, Any] | None:
    """Get a template and customize it based on user preferences."""
    import copy

    template = STRATEGY_TEMPLATES.get(template_id)
    if not template:
        return None

    customized = copy.deepcopy(template)

    if market:
        customized["universe"]["market"] = market
        if market == "IN" and currency is None:
            currency = "INR"
        elif market == "US" and currency is None:
            currency = "USD"

    if tickers:
        customized["universe"]["tickers"] = tickers

    if capital:
        customized["backtest_config"]["initial_capital"] = capital

    if currency:
        customized["backtest_config"]["currency"] = currency
        if currency == "INR":
            customized["backtest_config"]["commission_percent"] = 0.03
            customized["backtest_config"]["slippage_percent"] = 0.1

    return customized
