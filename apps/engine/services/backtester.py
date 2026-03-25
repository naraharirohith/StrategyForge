"""
Backtesting loop for StrategyForge engine.

Runs an event-driven backtest over OHLCV data with indicator columns,
evaluating entry/exit rules bar-by-bar. Produces trade list, equity curve,
and summary metrics.

Bug fixes applied:
- Trailing stop now works for short positions (tracks lowest_since_entry).
- cooldown_bars on entry rules is now enforced.
"""

from .condition_evaluator import evaluate_conditions


def run_backtest_on_df(df, strategy: dict) -> tuple:
    """
    Run the backtest loop on an already-prepared DataFrame (indicators computed, warmup trimmed).

    This is the inner loop extracted for reuse by walk-forward validation.

    Args:
        df: DataFrame with OHLCV and indicator columns (already trimmed past warmup).
        strategy: Full strategy definition dict.

    Returns:
        Tuple of (trades, equity_curve, final_capital).
    """
    bt_config = strategy.get("backtest_config", {})
    initial_capital = bt_config.get("initial_capital", 100000)
    commission = bt_config.get("commission_percent", 0.1) / 100
    slippage = bt_config.get("slippage_percent", 0.05) / 100
    indicators = strategy.get("indicators", [])
    primary_ticker = strategy.get("universe", {}).get("tickers", ["UNKNOWN"])[0]

    result = _run_backtest_core(
        df=df,
        strategy=strategy,
        primary_ticker=primary_ticker,
        initial_capital=initial_capital,
        commission=commission,
        slippage=slippage,
        indicators=indicators,
    )
    return (result["trades"], result["equity_curve"], result["capital"])


def run_backtest(
    df,
    strategy: dict,
    primary_ticker: str,
    initial_capital: float,
    commission: float,
    slippage: float,
    indicators: list,
) -> dict:
    """
    Run the event-driven backtest loop.

    Args:
        df: DataFrame with OHLCV and indicator columns (already trimmed past warmup).
        strategy: Full strategy definition dict.
        primary_ticker: The ticker symbol being backtested.
        initial_capital: Starting capital.
        commission: Commission as a decimal fraction (e.g. 0.001 for 0.1%).
        slippage: Slippage as a decimal fraction (e.g. 0.0005 for 0.05%).
        indicators: List of indicator config dicts.

    Returns:
        Dict with keys: trades, equity_curve, capital.
    """
    return _run_backtest_core(
        df=df,
        strategy=strategy,
        primary_ticker=primary_ticker,
        initial_capital=initial_capital,
        commission=commission,
        slippage=slippage,
        indicators=indicators,
    )


def _run_backtest_core(
    df,
    strategy: dict,
    primary_ticker: str,
    initial_capital: float,
    commission: float,
    slippage: float,
    indicators: list,
) -> dict:
    """
    Core backtest loop shared by run_backtest and run_backtest_on_df.

    Args:
        df: DataFrame with OHLCV and indicator columns (already trimmed past warmup).
        strategy: Full strategy definition dict.
        primary_ticker: The ticker symbol being backtested.
        initial_capital: Starting capital.
        commission: Commission as a decimal fraction (e.g. 0.001 for 0.1%).
        slippage: Slippage as a decimal fraction (e.g. 0.0005 for 0.05%).
        indicators: List of indicator config dicts.

    Returns:
        Dict with keys: trades, equity_curve, capital.
    """
    capital = initial_capital
    position = None  # { side, entry_price, entry_date, size, entry_idx, ... }
    trades = []
    equity_curve = []
    peak_equity = initial_capital

    entry_rules = strategy.get("entry_rules", [])
    exit_rules = sorted(strategy.get("exit_rules", []), key=lambda r: r.get("priority", 99))

    # Bug fix: Track last entry bar per ticker for cooldown enforcement
    cooldown_tracker = {}  # ticker -> last_entry_bar

    for i in range(1, len(df)):
        current_bar = df.iloc[i]
        prev_bar = df.iloc[i - 1]
        current_date = str(df.index[i])
        current_price = float(current_bar["Close"])

        current_equity = capital
        if position:
            unrealized = (current_price - position["entry_price"]) * position["size"]
            if position["side"] == "short":
                unrealized = -unrealized
            current_equity = capital + unrealized

        equity_curve.append([current_date, round(current_equity, 2)])
        peak_equity = max(peak_equity, current_equity)

        # --- Check exits first ---
        if position:
            exit_triggered = False
            exit_reason = ""

            for rule in exit_rules:
                if rule["type"] == "stop_loss" and rule.get("value"):
                    sl_pct = rule["value"] / 100
                    if position["side"] == "long":
                        if current_price <= position["entry_price"] * (1 - sl_pct):
                            exit_triggered = True
                            exit_reason = "stop_loss"
                    else:
                        if current_price >= position["entry_price"] * (1 + sl_pct):
                            exit_triggered = True
                            exit_reason = "stop_loss"

                elif rule["type"] == "take_profit" and rule.get("value"):
                    tp_pct = rule["value"] / 100
                    if position["side"] == "long":
                        if current_price >= position["entry_price"] * (1 + tp_pct):
                            exit_triggered = True
                            exit_reason = "take_profit"
                    else:
                        if current_price <= position["entry_price"] * (1 - tp_pct):
                            exit_triggered = True
                            exit_reason = "take_profit"

                elif rule["type"] == "time_based" and rule.get("value"):
                    bars_held = i - position["entry_idx"]
                    if bars_held >= rule["value"]:
                        exit_triggered = True
                        exit_reason = "time_exit"

                elif rule["type"] == "trailing_stop" and rule.get("value"):
                    # Bug fix: Trailing stop now supports both long and short positions.
                    # For longs, tracks highest_since_entry; for shorts, tracks lowest_since_entry.
                    trail_pct = rule["value"] / 100
                    if position["side"] == "long":
                        trail_stop = position.get("highest_since_entry", position["entry_price"]) * (1 - trail_pct)
                        if current_price <= trail_stop:
                            exit_triggered = True
                            exit_reason = "trailing_stop"
                        else:
                            position["highest_since_entry"] = max(
                                position.get("highest_since_entry", position["entry_price"]),
                                current_price
                            )
                    else:  # short
                        trail_stop = position.get("lowest_since_entry", position["entry_price"]) * (1 + trail_pct)
                        if current_price >= trail_stop:
                            exit_triggered = True
                            exit_reason = "trailing_stop"
                        else:
                            position["lowest_since_entry"] = min(
                                position.get("lowest_since_entry", position["entry_price"]),
                                current_price
                            )

                if exit_triggered:
                    break

            if exit_triggered:
                exit_price = current_price * (1 - slippage if position["side"] == "long" else 1 + slippage)
                comm = abs(exit_price * position["size"] * commission)

                if position["side"] == "long":
                    pnl = (exit_price - position["entry_price"]) * position["size"] - comm - position["entry_commission"]
                else:
                    pnl = (position["entry_price"] - exit_price) * position["size"] - comm - position["entry_commission"]

                pnl_pct = (pnl / (position["entry_price"] * position["size"])) * 100

                trades.append({
                    "ticker": primary_ticker,
                    "side": position["side"],
                    "entry_date": position["entry_date"],
                    "entry_price": round(position["entry_price"], 4),
                    "exit_date": current_date,
                    "exit_price": round(exit_price, 4),
                    "exit_reason": exit_reason,
                    "position_size": position["size"],
                    "pnl": round(pnl, 2),
                    "pnl_percent": round(pnl_pct, 2),
                    "holding_bars": i - position["entry_idx"],
                    "commission_paid": round(comm + position["entry_commission"], 4),
                })

                capital += pnl
                position = None

        # --- Check entries ---
        if position is None and entry_rules:
            for rule in entry_rules:
                # Bug fix: Enforce cooldown_bars -- skip this rule if still in cooldown
                cooldown = rule.get("cooldown_bars", 0)
                if cooldown > 0:
                    last = cooldown_tracker.get(primary_ticker, -999)
                    if i - last < cooldown:
                        continue  # skip this rule, still in cooldown

                entry_triggered = evaluate_conditions(
                    rule.get("conditions", {}), df, i, indicators
                )

                if entry_triggered:
                    side = rule.get("side", "long")
                    sizing = rule.get("position_sizing", {"method": "percent_of_portfolio", "percent": 10})

                    if sizing["method"] == "percent_of_portfolio":
                        alloc = capital * (sizing.get("percent", 10) / 100)
                    elif sizing["method"] == "fixed_amount":
                        alloc = min(sizing.get("amount", 10000), capital * 0.95)
                    else:
                        alloc = capital * 0.1  # fallback

                    entry_price = current_price * (1 + slippage if side == "long" else 1 - slippage)
                    size = alloc / entry_price
                    entry_comm = abs(entry_price * size * commission)

                    position = {
                        "side": side,
                        "entry_price": entry_price,
                        "entry_date": current_date,
                        "size": size,
                        "entry_idx": i,
                        "entry_commission": entry_comm,
                        "highest_since_entry": entry_price,
                        "lowest_since_entry": entry_price,  # Bug fix: track for short trailing stops
                    }

                    # Bug fix: Record entry bar for cooldown tracking
                    cooldown_tracker[primary_ticker] = i
                    break

    # Close any open position at end
    if position:
        final_price = float(df.iloc[-1]["Close"])
        comm = abs(final_price * position["size"] * commission)
        if position["side"] == "long":
            pnl = (final_price - position["entry_price"]) * position["size"] - comm - position["entry_commission"]
        else:
            pnl = (position["entry_price"] - final_price) * position["size"] - comm - position["entry_commission"]
        pnl_pct = (pnl / (position["entry_price"] * position["size"])) * 100
        trades.append({
            "ticker": primary_ticker,
            "side": position["side"],
            "entry_date": position["entry_date"],
            "entry_price": round(position["entry_price"], 4),
            "exit_date": str(df.index[-1]),
            "exit_price": round(final_price, 4),
            "exit_reason": "end_of_data",
            "position_size": position["size"],
            "pnl": round(pnl, 2),
            "pnl_percent": round(pnl_pct, 2),
            "holding_bars": len(df) - 1 - position["entry_idx"],
            "commission_paid": round(comm + position["entry_commission"], 4),
        })
        capital += pnl

    return {
        "trades": trades,
        "equity_curve": equity_curve,
        "capital": capital,
    }
