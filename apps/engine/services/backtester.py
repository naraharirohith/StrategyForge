"""
Backtesting loop for StrategyForge engine.

Supports both single-ticker and multi-ticker backtesting:
- Single-ticker: Original behavior, evaluates entry/exit on one DataFrame.
- Multi-ticker: Iterates bar-by-bar across all tickers simultaneously,
  managing positions per-ticker with portfolio-level constraints
  (max_position_count, max_portfolio_drawdown).

Bug fixes applied:
- Trailing stop now works for short positions (tracks lowest_since_entry).
- cooldown_bars on entry rules is now enforced.
"""

import pandas as pd
import numpy as np
from .condition_evaluator import evaluate_conditions


def _find_atr_value(df, bar_idx: int) -> float | None:
    """Return the first valid ATR-like indicator value on the current bar."""
    if df is None or bar_idx < 0:
        return None

    atr_columns = [
        col for col in df.columns
        if str(col).upper().startswith("ATR") or "_ATR" in str(col).upper()
    ]
    for column in atr_columns:
        value = df.iloc[bar_idx][column]
        if pd.notna(value) and float(value) > 0:
            return float(value)
    return None


def _calculate_recent_realized_vol(df, bar_idx: int, window: int = 20) -> float | None:
    """Compute recent realized daily volatility from Close prices up to the current bar."""
    if df is None or "Close" not in df.columns or bar_idx < 1:
        return None

    start_idx = max(0, bar_idx - window + 1)
    close_slice = df.iloc[start_idx:bar_idx + 1]["Close"].astype(float)
    returns = close_slice.pct_change().dropna()
    if len(returns) < 2:
        return None

    realized_vol = float(returns.std())
    return realized_vol if np.isfinite(realized_vol) and realized_vol > 0 else None


def run_backtest_on_df(df, strategy: dict) -> tuple:
    """
    Run the backtest loop on an already-prepared DataFrame (indicators computed, warmup trimmed).

    This is the inner loop extracted for reuse by walk-forward validation.
    Always runs single-ticker mode (backward compatible).

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
    Run the event-driven backtest loop (single ticker).

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


def run_backtest_multi(
    ticker_dfs: dict,
    strategy: dict,
    initial_capital: float,
    commission: float,
    slippage: float,
    indicators: list,
) -> dict:
    """
    Run an event-driven backtest across multiple tickers simultaneously.

    Iterates through a unified date index. At each bar, checks exits for all
    open positions, then checks entries for all tickers (respecting max_position_count).

    Args:
        ticker_dfs: Dict of {ticker: DataFrame} with OHLCV + indicator columns.
        strategy: Full strategy definition dict.
        initial_capital: Starting capital.
        commission: Commission as a decimal fraction.
        slippage: Slippage as a decimal fraction.
        indicators: List of indicator config dicts.

    Returns:
        Dict with keys: trades, equity_curve, capital, per_ticker_trades.
    """
    if not ticker_dfs:
        return {"trades": [], "equity_curve": [], "capital": initial_capital, "per_ticker_trades": {}}

    # If only one ticker, delegate to single-ticker path
    if len(ticker_dfs) == 1:
        ticker, df = next(iter(ticker_dfs.items()))
        result = _run_backtest_core(
            df=df, strategy=strategy, primary_ticker=ticker,
            initial_capital=initial_capital, commission=commission,
            slippage=slippage, indicators=indicators,
        )
        result["per_ticker_trades"] = {ticker: result["trades"]}
        return result

    return _run_backtest_multi_core(
        ticker_dfs=ticker_dfs,
        strategy=strategy,
        initial_capital=initial_capital,
        commission=commission,
        slippage=slippage,
        indicators=indicators,
    )


# ==================================================================
# Single-ticker core (original logic, preserved)
# ==================================================================

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
    """
    capital = initial_capital
    position = None
    trades = []
    equity_curve = []
    peak_equity = initial_capital
    drawdown_halt = False

    # Read risk management limits from strategy
    risk_mgmt = strategy.get("risk_management", {})
    max_drawdown_pct = risk_mgmt.get("max_portfolio_drawdown_percent", 100)
    max_positions = risk_mgmt.get("max_position_count", 1)

    entry_rules = strategy.get("entry_rules", [])
    exit_rules = sorted(strategy.get("exit_rules", []), key=lambda r: r.get("priority", 99))

    cooldown_tracker = {}

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

        # Check portfolio drawdown halt
        if peak_equity > 0:
            current_dd = ((current_equity - peak_equity) / peak_equity) * 100
            if current_dd <= -max_drawdown_pct:
                drawdown_halt = True

        # --- Check exits first ---
        if position:
            exit_triggered, exit_reason = _check_exits(
                position, exit_rules, current_price, i, df=df, indicators=indicators
            )

            # Force close if drawdown halted
            if drawdown_halt and not exit_triggered:
                exit_triggered = True
                exit_reason = "max_drawdown"

            if exit_triggered:
                trade, pnl = _close_position(
                    position, primary_ticker, current_price, current_date,
                    i, slippage, commission, exit_reason=exit_reason
                )
                trades.append(trade)
                capital += pnl
                position = None

        # Skip entries if drawdown halted
        if drawdown_halt:
            continue

        # --- Check entries ---
        if position is None and entry_rules:
            for rule in entry_rules:
                cooldown = rule.get("cooldown_bars", 0)
                if cooldown > 0:
                    last = cooldown_tracker.get(primary_ticker, -999)
                    if i - last < cooldown:
                        continue

                entry_triggered = evaluate_conditions(
                    rule.get("conditions", {}), df, i, indicators
                )

                if entry_triggered:
                    position = _open_position(
                        rule, capital, current_price, current_date, i, slippage, commission,
                        df=df, bar_idx=i, max_positions=max_positions,
                    )
                    cooldown_tracker[primary_ticker] = i
                    break

    # Close any open position at end
    if position:
        trade, pnl = _close_position(
            position, primary_ticker, float(df.iloc[-1]["Close"]),
            str(df.index[-1]), len(df) - 1, slippage, commission,
            exit_reason="end_of_data"
        )
        trades.append(trade)
        capital += pnl

    return {"trades": trades, "equity_curve": equity_curve, "capital": capital}


# ==================================================================
# Multi-ticker core
# ==================================================================

def _run_backtest_multi_core(
    ticker_dfs: dict,
    strategy: dict,
    initial_capital: float,
    commission: float,
    slippage: float,
    indicators: list,
) -> dict:
    """
    Core multi-ticker backtest loop.

    Builds a unified date index across all tickers, then iterates bar-by-bar.
    Manages a portfolio of positions with max_position_count enforcement.
    """
    risk_mgmt = strategy.get("risk_management", {})
    max_positions = risk_mgmt.get("max_position_count", 5)
    max_drawdown_pct = risk_mgmt.get("max_portfolio_drawdown_percent", 100)

    entry_rules = strategy.get("entry_rules", [])
    exit_rules = sorted(strategy.get("exit_rules", []), key=lambda r: r.get("priority", 99))

    # Build unified date index (union of all tickers' dates)
    all_dates = set()
    for df in ticker_dfs.values():
        all_dates.update(df.index.tolist())
    all_dates = sorted(all_dates)

    if len(all_dates) < 2:
        return {"trades": [], "equity_curve": [], "capital": initial_capital, "per_ticker_trades": {}}

    # Build per-ticker bar index lookups for fast access
    ticker_bar_idx = {}  # ticker -> {date: integer index in that ticker's df}
    for ticker, df in ticker_dfs.items():
        ticker_bar_idx[ticker] = {date: idx for idx, date in enumerate(df.index)}

    capital = initial_capital
    positions = {}  # ticker -> position dict
    trades = []
    equity_curve = []
    peak_equity = initial_capital
    cooldown_tracker = {}  # ticker -> last_entry_date_idx in unified index
    drawdown_halt = False

    for date_i, current_date in enumerate(all_dates):
        if date_i == 0:
            continue  # Need at least 1 previous bar

        current_date_str = str(current_date)

        # Calculate portfolio equity (cash + all open positions)
        portfolio_equity = capital
        for ticker, pos in positions.items():
            df = ticker_dfs[ticker]
            bar_idx = ticker_bar_idx[ticker].get(current_date)
            if bar_idx is not None:
                price = float(df.iloc[bar_idx]["Close"])
                unrealized = (price - pos["entry_price"]) * pos["size"]
                if pos["side"] == "short":
                    unrealized = -unrealized
                portfolio_equity += unrealized
            else:
                # Ticker has no data on this date — use last known price
                portfolio_equity += pos.get("last_unrealized", 0)

        equity_curve.append([current_date_str, round(portfolio_equity, 2)])
        peak_equity = max(peak_equity, portfolio_equity)

        # Check portfolio drawdown halt
        if peak_equity > 0:
            current_dd = ((portfolio_equity - peak_equity) / peak_equity) * 100
            if current_dd <= -max_drawdown_pct:
                drawdown_halt = True

        # --- Check exits for all open positions ---
        tickers_to_close = []
        for ticker, pos in list(positions.items()):
            df = ticker_dfs[ticker]
            bar_idx = ticker_bar_idx[ticker].get(current_date)
            if bar_idx is None or bar_idx < 1:
                continue

            current_price = float(df.iloc[bar_idx]["Close"])

            # Update last_unrealized for dates when ticker has data
            unrealized = (current_price - pos["entry_price"]) * pos["size"]
            if pos["side"] == "short":
                unrealized = -unrealized
            pos["last_unrealized"] = unrealized

            exit_triggered, exit_reason = _check_exits(
                pos, exit_rules, current_price, bar_idx, df=df, indicators=indicators
            )

            # Force close if drawdown halt triggered
            if drawdown_halt and not exit_triggered:
                exit_triggered = True
                exit_reason = "max_drawdown"

            if exit_triggered:
                trade, pnl = _close_position(
                    pos, ticker, current_price, current_date_str,
                    bar_idx, slippage, commission, exit_reason=exit_reason
                )
                trades.append(trade)
                capital += pnl
                tickers_to_close.append(ticker)

        for ticker in tickers_to_close:
            del positions[ticker]

        # --- Check entries (skip if drawdown halted or at max positions) ---
        if drawdown_halt or len(positions) >= max_positions:
            continue

        for ticker, df in ticker_dfs.items():
            if ticker in positions:
                continue  # Already have a position in this ticker
            if len(positions) >= max_positions:
                break

            bar_idx = ticker_bar_idx[ticker].get(current_date)
            if bar_idx is None or bar_idx < 1:
                continue

            current_price = float(df.iloc[bar_idx]["Close"])

            for rule in entry_rules:
                cooldown = rule.get("cooldown_bars", 0)
                if cooldown > 0:
                    last = cooldown_tracker.get(ticker, -999)
                    if date_i - last < cooldown:
                        continue

                entry_triggered = evaluate_conditions(
                    rule.get("conditions", {}), df, bar_idx, indicators
                )

                if entry_triggered:
                    # For equal_weight, _open_position divides capital by max_positions
                    # internally — pass full remaining capital so it isn't divided twice.
                    # For percent_of_portfolio / fixed_amount, pre-scale to a fair share
                    # of remaining slots so one signal can't consume the full portfolio.
                    sizing_method = rule.get("position_sizing", {}).get("method", "percent_of_portfolio")
                    if sizing_method == "equal_weight":
                        cap_for_position = capital
                    else:
                        cap_for_position = capital / max(1, max_positions - len(positions))
                    position = _open_position(
                        rule, cap_for_position, current_price,
                        current_date_str, bar_idx, slippage, commission,
                        df=df, bar_idx=bar_idx, max_positions=max_positions,
                    )
                    position["last_unrealized"] = 0
                    positions[ticker] = position
                    cooldown_tracker[ticker] = date_i
                    break

    # Close any remaining open positions at end of data
    for ticker, pos in positions.items():
        df = ticker_dfs[ticker]
        final_price = float(df.iloc[-1]["Close"])
        trade, pnl = _close_position(
            pos, ticker, final_price, str(df.index[-1]),
            len(df) - 1, slippage, commission, exit_reason="end_of_data"
        )
        trades.append(trade)
        capital += pnl

    # Build per-ticker trade grouping
    per_ticker_trades = {}
    for trade in trades:
        t = trade["ticker"]
        if t not in per_ticker_trades:
            per_ticker_trades[t] = []
        per_ticker_trades[t].append(trade)

    return {
        "trades": trades,
        "equity_curve": equity_curve,
        "capital": capital,
        "per_ticker_trades": per_ticker_trades,
    }


# ==================================================================
# Shared helpers
# ==================================================================

def _check_exits(
    position: dict,
    exit_rules: list,
    current_price: float,
    bar_idx: int,
    df=None,
    indicators: list | None = None,
) -> tuple:
    """
    Check all exit rules against a position.

    Returns (exit_triggered: bool, exit_reason: str).
    """
    for rule in exit_rules:
        if rule["type"] == "stop_loss" and rule.get("value"):
            sl_pct = rule["value"] / 100
            if position["side"] == "long":
                if current_price <= position["entry_price"] * (1 - sl_pct):
                    return True, "stop_loss"
            else:
                if current_price >= position["entry_price"] * (1 + sl_pct):
                    return True, "stop_loss"

        elif rule["type"] == "take_profit" and rule.get("value"):
            tp_pct = rule["value"] / 100
            if position["side"] == "long":
                if current_price >= position["entry_price"] * (1 + tp_pct):
                    return True, "take_profit"
            else:
                if current_price <= position["entry_price"] * (1 - tp_pct):
                    return True, "take_profit"

        elif rule["type"] == "time_based" and rule.get("value"):
            bars_held = bar_idx - position["entry_idx"]
            if bars_held >= rule["value"]:
                return True, "time_exit"

        elif rule["type"] == "trailing_stop" and rule.get("value"):
            trail_pct = rule["value"] / 100
            if position["side"] == "long":
                trail_stop = position.get("highest_since_entry", position["entry_price"]) * (1 - trail_pct)
                if current_price <= trail_stop:
                    return True, "trailing_stop"
                else:
                    position["highest_since_entry"] = max(
                        position.get("highest_since_entry", position["entry_price"]),
                        current_price
                    )
            else:
                trail_stop = position.get("lowest_since_entry", position["entry_price"]) * (1 + trail_pct)
                if current_price >= trail_stop:
                    return True, "trailing_stop"
                else:
                    position["lowest_since_entry"] = min(
                        position.get("lowest_since_entry", position["entry_price"]),
                        current_price
                    )

        elif rule["type"] in {"indicator", "indicator_based"} and rule.get("conditions"):
            if df is not None and evaluate_conditions(rule["conditions"], df, bar_idx, indicators or []):
                return True, "indicator_exit"

    return False, ""


def _open_position(
    rule: dict,
    available_capital: float,
    current_price: float,
    current_date: str,
    entry_idx: int,
    slippage: float,
    commission: float,
    df=None,
    bar_idx: int | None = None,
    max_positions: int = 1,
) -> dict:
    """Create a new position dict from an entry rule."""
    side = rule.get("side", "long")
    sizing = rule.get("position_sizing", {"method": "percent_of_portfolio", "percent": 10})
    current_bar_idx = entry_idx if bar_idx is None else bar_idx

    if sizing["method"] == "percent_of_portfolio":
        alloc = available_capital * (sizing.get("percent", 10) / 100)
    elif sizing["method"] == "fixed_amount":
        alloc = min(sizing.get("amount", 10000), available_capital * 0.95)
    elif sizing["method"] == "equal_weight":
        alloc = available_capital / max(1, max_positions)
    elif sizing["method"] == "percent_risk":
        risk_percent = sizing.get("percent", sizing.get("risk_percent", 1)) / 100
        multiplier = sizing.get("atr_multiplier", 1)
        atr_value = _find_atr_value(df, current_bar_idx)
        stop_distance = atr_value * multiplier if atr_value is not None else current_price * 0.02
        stop_distance = max(stop_distance, current_price * 0.001)
        risk_amount = available_capital * risk_percent
        size = risk_amount / stop_distance if stop_distance > 0 else 0
        alloc = min(available_capital * 0.25, size * current_price)
    elif sizing["method"] == "volatility_adjusted":
        target_vol = sizing.get("target_vol", sizing.get("target_volatility", 15)) / 100
        realized_vol = _calculate_recent_realized_vol(df, current_bar_idx)
        if realized_vol is not None:
            vol_scaled_alloc = available_capital * (target_vol / (realized_vol * np.sqrt(252)))
            alloc = min(available_capital * 0.25, vol_scaled_alloc)
        else:
            alloc = available_capital * 0.1
    else:
        alloc = available_capital * 0.1  # fallback

    alloc = max(0.0, min(float(alloc), available_capital))
    entry_price = current_price * (1 + slippage if side == "long" else 1 - slippage)
    size = alloc / entry_price if entry_price > 0 else 0
    entry_comm = abs(entry_price * size * commission)

    return {
        "side": side,
        "entry_price": entry_price,
        "entry_date": current_date,
        "size": size,
        "entry_idx": entry_idx,
        "entry_commission": entry_comm,
        "highest_since_entry": entry_price,
        "lowest_since_entry": entry_price,
    }


def _close_position(
    position: dict,
    ticker: str,
    current_price: float,
    current_date: str,
    bar_idx: int,
    slippage: float,
    commission: float,
    exit_reason: str = "",
) -> tuple:
    """
    Close a position and return (trade_dict, realized_pnl).
    """
    exit_price = current_price * (1 - slippage if position["side"] == "long" else 1 + slippage)
    comm = abs(exit_price * position["size"] * commission)

    if position["side"] == "long":
        pnl = (exit_price - position["entry_price"]) * position["size"] - comm - position["entry_commission"]
    else:
        pnl = (position["entry_price"] - exit_price) * position["size"] - comm - position["entry_commission"]

    pnl_pct = (pnl / (position["entry_price"] * position["size"])) * 100

    trade = {
        "ticker": ticker,
        "side": position["side"],
        "entry_date": position["entry_date"],
        "entry_price": round(position["entry_price"], 4),
        "exit_date": current_date,
        "exit_price": round(exit_price, 4),
        "exit_reason": exit_reason,
        "position_size": position["size"],
        "pnl": round(pnl, 2),
        "pnl_percent": round(pnl_pct, 2),
        "holding_bars": bar_idx - position["entry_idx"],
        "commission_paid": round(comm + position["entry_commission"], 4),
    }

    return trade, pnl
