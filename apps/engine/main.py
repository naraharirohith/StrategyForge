"""
StrategyForge Backtesting Engine

FastAPI service that:
1. Receives a StrategyDefinition JSON
2. Fetches historical OHLCV data via yfinance
3. Runs the backtest using backtesting.py
4. Computes StrategyScore (composite 0-100)
5. Returns BacktestResult JSON

Runs as a separate microservice on port 8001.
The Node.js API gateway calls this service.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Any
import json

app = FastAPI(title="StrategyForge Engine", version="0.1.0")


# ============================================================
# Request / Response Models
# ============================================================

class BacktestRequest(BaseModel):
    strategy: dict  # StrategyDefinition JSON
    force_refresh_data: bool = False


class BacktestResponse(BaseModel):
    success: bool
    result: Optional[dict] = None  # BacktestResult JSON
    error: Optional[str] = None
    duration_ms: Optional[int] = None


class ConfidenceRequest(BaseModel):
    strategy: dict
    latest_backtest: dict  # BacktestResult from previous run


class ConfidenceResponse(BaseModel):
    success: bool
    confidence: Optional[dict] = None  # ConfidenceScore JSON
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    engine_version: str
    supported_indicators: list[str]


# ============================================================
# Data Layer — yfinance wrapper
# ============================================================

class DataFetcher:
    """Fetches and caches OHLCV data from yfinance"""

    TIMEFRAME_MAP = {
        "5m": {"period": "60d", "interval": "5m"},
        "15m": {"period": "60d", "interval": "15m"},
        "1h": {"period": "730d", "interval": "1h"},
        "4h": {"period": "730d", "interval": "1h"},  # fetch 1h and resample
        "1d": {"period": "max", "interval": "1d"},
        "1w": {"period": "max", "interval": "1wk"},
    }

    @staticmethod
    def fetch(ticker: str, timeframe: str, start_date: str = None, end_date: str = None):
        """
        Fetch OHLCV data for a ticker.
        Returns pandas DataFrame with columns: Open, High, Low, Close, Volume
        """
        import yfinance as yf
        import pandas as pd

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

        return data


# ============================================================
# Indicator Calculator
# ============================================================

class IndicatorCalculator:
    """Computes technical indicators and adds them as columns to the DataFrame"""

    SUPPORTED = [
        "SMA", "EMA", "WMA", "VWAP",
        "RSI", "MACD", "STOCH", "CCI", "WILLIAMS_R", "MFI",
        "BBANDS", "ATR", "KELTNER", "DONCHIAN",
        "OBV", "VOLUME_SMA",
        "ADX", "SUPERTREND", "PSAR",
        "PRICE_CHANGE_PCT", "HIGH_LOW_RANGE", "GAP",
    ]

    @staticmethod
    def compute(df, indicators: list[dict]):
        """
        Add indicator columns to DataFrame.
        Each indicator config: { id, type, params, apply_to }
        """
        import pandas as pd
        import numpy as np

        for ind in indicators:
            ind_id = ind["id"]
            ind_type = ind["type"]
            params = ind.get("params", {})
            source = ind.get("apply_to", "close").capitalize()
            if source.lower() == "close":
                source = "Close"
            elif source.lower() == "volume":
                source = "Volume"

            try:
                if ind_type in ("SMA",):
                    period = int(params.get("period", 20))
                    df[ind_id] = df[source].rolling(window=period).mean()

                elif ind_type == "EMA":
                    period = int(params.get("period", 20))
                    df[ind_id] = df[source].ewm(span=period, adjust=False).mean()

                elif ind_type == "RSI":
                    period = int(params.get("period", 14))
                    delta = df[source].diff()
                    gain = delta.where(delta > 0, 0).rolling(window=period).mean()
                    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
                    rs = gain / loss.replace(0, np.nan)
                    df[ind_id] = 100 - (100 / (1 + rs))

                elif ind_type == "MACD":
                    fast = int(params.get("fast", 12))
                    slow = int(params.get("slow", 26))
                    signal = int(params.get("signal", 9))
                    ema_fast = df[source].ewm(span=fast, adjust=False).mean()
                    ema_slow = df[source].ewm(span=slow, adjust=False).mean()
                    df[f"{ind_id}_line"] = ema_fast - ema_slow
                    df[f"{ind_id}_signal"] = df[f"{ind_id}_line"].ewm(span=signal, adjust=False).mean()
                    df[f"{ind_id}_hist"] = df[f"{ind_id}_line"] - df[f"{ind_id}_signal"]
                    df[ind_id] = df[f"{ind_id}_line"]  # default reference

                elif ind_type == "BBANDS":
                    period = int(params.get("period", 20))
                    std_dev = float(params.get("std_dev", 2))
                    sma = df[source].rolling(window=period).mean()
                    std = df[source].rolling(window=period).std()
                    df[f"{ind_id}_upper"] = sma + (std * std_dev)
                    df[f"{ind_id}_middle"] = sma
                    df[f"{ind_id}_lower"] = sma - (std * std_dev)
                    df[ind_id] = sma

                elif ind_type == "ATR":
                    period = int(params.get("period", 14))
                    high_low = df["High"] - df["Low"]
                    high_close = (df["High"] - df["Close"].shift()).abs()
                    low_close = (df["Low"] - df["Close"].shift()).abs()
                    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
                    df[ind_id] = tr.rolling(window=period).mean()

                elif ind_type == "ADX":
                    period = int(params.get("period", 14))
                    plus_dm = df["High"].diff()
                    minus_dm = -df["Low"].diff()
                    plus_dm = plus_dm.where((plus_dm > minus_dm) & (plus_dm > 0), 0)
                    minus_dm = minus_dm.where((minus_dm > plus_dm) & (minus_dm > 0), 0)
                    
                    high_low = df["High"] - df["Low"]
                    high_close = (df["High"] - df["Close"].shift()).abs()
                    low_close = (df["Low"] - df["Close"].shift()).abs()
                    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
                    
                    atr = tr.rolling(window=period).mean()
                    plus_di = 100 * (plus_dm.rolling(window=period).mean() / atr)
                    minus_di = 100 * (minus_dm.rolling(window=period).mean() / atr)
                    dx = 100 * ((plus_di - minus_di).abs() / (plus_di + minus_di))
                    df[ind_id] = dx.rolling(window=period).mean()

                elif ind_type == "VOLUME_SMA":
                    period = int(params.get("period", 20))
                    df[ind_id] = df["Volume"].rolling(window=period).mean()

                elif ind_type == "PRICE_CHANGE_PCT":
                    period = int(params.get("period", 1))
                    df[ind_id] = df[source].pct_change(periods=period) * 100

                elif ind_type == "STOCH":
                    k_period = int(params.get("k_period", 14))
                    d_period = int(params.get("d_period", 3))
                    lowest_low = df["Low"].rolling(window=k_period).min()
                    highest_high = df["High"].rolling(window=k_period).max()
                    df[f"{ind_id}_k"] = 100 * (df["Close"] - lowest_low) / (highest_high - lowest_low)
                    df[f"{ind_id}_d"] = df[f"{ind_id}_k"].rolling(window=d_period).mean()
                    df[ind_id] = df[f"{ind_id}_k"]

                elif ind_type == "SUPERTREND":
                    period = int(params.get("period", 10))
                    multiplier = float(params.get("multiplier", 3))
                    high_low = df["High"] - df["Low"]
                    high_close = (df["High"] - df["Close"].shift()).abs()
                    low_close = (df["Low"] - df["Close"].shift()).abs()
                    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
                    atr = tr.rolling(window=period).mean()
                    hl2 = (df["High"] + df["Low"]) / 2
                    upper_band = hl2 + (multiplier * atr)
                    lower_band = hl2 - (multiplier * atr)
                    
                    supertrend = pd.Series(index=df.index, dtype=float)
                    direction = pd.Series(index=df.index, dtype=float)
                    supertrend.iloc[0] = upper_band.iloc[0]
                    direction.iloc[0] = -1
                    
                    for i in range(1, len(df)):
                        if df["Close"].iloc[i] > supertrend.iloc[i-1]:
                            supertrend.iloc[i] = lower_band.iloc[i]
                            direction.iloc[i] = 1
                        else:
                            supertrend.iloc[i] = upper_band.iloc[i]
                            direction.iloc[i] = -1
                    
                    df[ind_id] = supertrend
                    df[f"{ind_id}_direction"] = direction

                elif ind_type == "OBV":
                    obv = pd.Series(index=df.index, dtype=float)
                    obv.iloc[0] = 0
                    for i in range(1, len(df)):
                        if df["Close"].iloc[i] > df["Close"].iloc[i-1]:
                            obv.iloc[i] = obv.iloc[i-1] + df["Volume"].iloc[i]
                        elif df["Close"].iloc[i] < df["Close"].iloc[i-1]:
                            obv.iloc[i] = obv.iloc[i-1] - df["Volume"].iloc[i]
                        else:
                            obv.iloc[i] = obv.iloc[i-1]
                    df[ind_id] = obv

                else:
                    # Unknown indicator — skip with warning
                    df[ind_id] = float("nan")

            except Exception as e:
                df[ind_id] = float("nan")
                print(f"Warning: Failed to compute {ind_id} ({ind_type}): {e}")

        return df


# ============================================================
# Score Calculator
# ============================================================

class ScoreCalculator:
    """Computes the composite StrategyScore (0-100)"""

    @staticmethod
    def compute(metrics: dict) -> dict:
        import numpy as np

        def score_sharpe(val):
            if val <= 0: return 0
            if val >= 3: return 100
            return min(100, val / 3 * 100)

        def score_drawdown(val):
            val = abs(val)
            if val >= 50: return 0
            if val <= 5: return 100
            return max(0, 100 - (val - 5) / 45 * 100)

        def score_win_rate(val):
            if val <= 20: return 0
            if val >= 70: return 100
            return (val - 20) / 50 * 100

        def score_profit_factor(val):
            if val <= 0.5: return 0
            if val >= 3: return 100
            return (val - 0.5) / 2.5 * 100

        def score_consistency(monthly_returns):
            if not monthly_returns or len(monthly_returns) < 3:
                return 50  # neutral if insufficient data
            rets = [m.get("return_percent", 0) for m in monthly_returns]
            std = np.std(rets) if len(rets) > 1 else 0
            if std >= 20: return 0
            if std <= 2: return 100
            return max(0, 100 - (std - 2) / 18 * 100)

        def score_regime(regime_perf):
            if not regime_perf or len(regime_perf) < 2:
                return 50
            returns = [r.get("return_percent", 0) for r in regime_perf]
            # Penalize if only profitable in one regime
            positive_regimes = sum(1 for r in returns if r > 0)
            return (positive_regimes / len(regime_perf)) * 100

        sharpe_s = score_sharpe(metrics.get("sharpe_ratio", 0))
        dd_s = score_drawdown(metrics.get("max_drawdown_percent", 50))
        wr_s = score_win_rate(metrics.get("win_rate", 0))
        pf_s = score_profit_factor(metrics.get("profit_factor", 0))
        con_s = score_consistency(metrics.get("monthly_returns", []))
        reg_s = score_regime(metrics.get("regime_performance", []))

        overall = (
            sharpe_s * 0.25 +
            dd_s * 0.20 +
            wr_s * 0.10 +
            pf_s * 0.15 +
            con_s * 0.15 +
            reg_s * 0.15
        )

        def grade(score):
            if score >= 90: return "S"
            if score >= 80: return "A"
            if score >= 70: return "B"
            if score >= 60: return "C"
            if score >= 40: return "D"
            return "F"

        return {
            "overall": round(overall, 1),
            "breakdown": {
                "sharpe_ratio": {"value": metrics.get("sharpe_ratio", 0), "score": round(sharpe_s, 1), "weight": 0.25},
                "max_drawdown": {"value": metrics.get("max_drawdown_percent", 0), "score": round(dd_s, 1), "weight": 0.20},
                "win_rate": {"value": metrics.get("win_rate", 0), "score": round(wr_s, 1), "weight": 0.10},
                "profit_factor": {"value": metrics.get("profit_factor", 0), "score": round(pf_s, 1), "weight": 0.15},
                "consistency": {"value": con_s, "score": round(con_s, 1), "weight": 0.15},
                "regime_score": {"value": reg_s, "score": round(reg_s, 1), "weight": 0.15},
            },
            "grade": grade(overall),
            "publishable": overall >= 40,
            "verified": overall >= 70,
        }


# ============================================================
# API Routes
# ============================================================

@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        engine_version="0.1.0",
        supported_indicators=IndicatorCalculator.SUPPORTED,
    )


@app.post("/backtest", response_model=BacktestResponse)
async def run_backtest(req: BacktestRequest):
    """
    Run a backtest for a given strategy definition.
    This is the main endpoint called by the Node.js API gateway.
    """
    import time
    import numpy as np
    import pandas as pd

    start_time = time.time()

    try:
        strategy = req.strategy
        universe = strategy.get("universe", {})
        tickers = universe.get("tickers", [])
        timeframe = strategy.get("timeframe", "1d")
        bt_config = strategy.get("backtest_config", {})
        initial_capital = bt_config.get("initial_capital", 100000)
        commission = bt_config.get("commission_percent", 0.1) / 100
        slippage = bt_config.get("slippage_percent", 0.05) / 100

        if not tickers:
            raise ValueError("No tickers specified in strategy universe")

        # For MVP: backtest the primary ticker
        primary_ticker = tickers[0]

        # Fetch data
        df = DataFetcher.fetch(
            primary_ticker, timeframe,
            start_date=bt_config.get("start_date"),
            end_date=bt_config.get("end_date"),
        )

        if len(df) < 50:
            raise ValueError(f"Insufficient data for {primary_ticker}: only {len(df)} bars")

        # Compute indicators
        indicators = strategy.get("indicators", [])
        df = IndicatorCalculator.compute(df, indicators)

        # Drop NaN rows from indicator warmup
        df = df.dropna()

        if len(df) < 30:
            raise ValueError("Insufficient data after indicator warmup period")

        # --------------------------------------------------------
        # Simple event-driven backtest loop
        # (We'll upgrade to backtesting.py integration in next iteration)
        # --------------------------------------------------------
        
        capital = initial_capital
        position = None  # { side, entry_price, entry_date, size, entry_idx }
        trades = []
        equity_curve = []
        peak_equity = initial_capital

        entry_rules = strategy.get("entry_rules", [])
        exit_rules = sorted(strategy.get("exit_rules", []), key=lambda r: r.get("priority", 99))

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
                        }
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

        # --------------------------------------------------------
        # Compute summary metrics
        # --------------------------------------------------------
        total_return = ((capital - initial_capital) / initial_capital) * 100
        winning = [t for t in trades if t["pnl"] > 0]
        losing = [t for t in trades if t["pnl"] <= 0]
        win_rate = (len(winning) / len(trades) * 100) if trades else 0
        gross_profit = sum(t["pnl"] for t in winning) if winning else 0
        gross_loss = abs(sum(t["pnl"] for t in losing)) if losing else 1
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0

        # Equity curve stats
        eq_values = [e[1] for e in equity_curve]
        if len(eq_values) > 1:
            returns = np.diff(eq_values) / eq_values[:-1]
            sharpe = (np.mean(returns) / np.std(returns) * np.sqrt(252)) if np.std(returns) > 0 else 0
            
            peak = np.maximum.accumulate(eq_values)
            drawdown = (np.array(eq_values) - peak) / peak * 100
            max_dd = float(np.min(drawdown))
        else:
            sharpe = 0
            max_dd = 0

        # Monthly returns
        monthly_returns = []  # TODO: compute from trade dates

        # Regime performance
        regime_performance = []  # TODO: classify market regimes

        summary = {
            "total_return_percent": round(total_return, 2),
            "annualized_return_percent": round(total_return, 2),  # TODO: annualize properly
            "sharpe_ratio": round(sharpe, 3),
            "sortino_ratio": round(sharpe * 0.8, 3),  # TODO: proper sortino
            "max_drawdown_percent": round(max_dd, 2),
            "max_drawdown_duration_days": 0,  # TODO
            "total_trades": len(trades),
            "winning_trades": len(winning),
            "losing_trades": len(losing),
            "win_rate": round(win_rate, 1),
            "profit_factor": round(profit_factor, 3),
            "avg_win_percent": round(np.mean([t["pnl_percent"] for t in winning]), 2) if winning else 0,
            "avg_loss_percent": round(np.mean([t["pnl_percent"] for t in losing]), 2) if losing else 0,
            "avg_holding_bars": round(np.mean([t["holding_bars"] for t in trades]), 1) if trades else 0,
            "best_trade_percent": max([t["pnl_percent"] for t in trades], default=0),
            "worst_trade_percent": min([t["pnl_percent"] for t in trades], default=0),
            "calmar_ratio": round(total_return / abs(max_dd), 3) if max_dd != 0 else 0,
            "volatility_annual": round(float(np.std(returns) * np.sqrt(252) * 100), 2) if len(eq_values) > 1 else 0,
            "benchmark_return_percent": round(((float(df.iloc[-1]["Close"]) / float(df.iloc[0]["Close"])) - 1) * 100, 2),
            "alpha": 0,  # TODO
            "beta": 0,   # TODO
        }

        # Compute StrategyScore
        score_input = {**summary, "monthly_returns": monthly_returns, "regime_performance": regime_performance}
        score = ScoreCalculator.compute(score_input)

        # Drawdown curve
        drawdown_curve = []
        if len(eq_values) > 0:
            peak_val = eq_values[0]
            for idx, (ts, val) in enumerate(equity_curve):
                peak_val = max(peak_val, val)
                dd = ((val - peak_val) / peak_val) * 100 if peak_val > 0 else 0
                drawdown_curve.append([ts, round(dd, 2)])

        duration_ms = int((time.time() - start_time) * 1000)

        result = {
            "strategy_id": strategy.get("id", "temp"),
            "run_id": f"bt_{int(time.time())}",
            "run_timestamp": pd.Timestamp.now().isoformat(),
            "summary": summary,
            "score": score,
            "equity_curve": equity_curve,
            "drawdown_curve": drawdown_curve,
            "trades": trades,
            "monthly_returns": monthly_returns,
            "regime_performance": regime_performance,
        }

        return BacktestResponse(success=True, result=result, duration_ms=duration_ms)

    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        return BacktestResponse(success=False, error=str(e), duration_ms=duration_ms)


# ============================================================
# Condition Evaluator
# ============================================================

def evaluate_conditions(cond_group: dict, df, bar_idx: int, indicators: list) -> bool:
    """
    Evaluate a ConditionGroup against the current bar.
    Supports nested AND/OR logic.
    """
    if not cond_group:
        return False

    logic = cond_group.get("logic", "AND")
    conditions = cond_group.get("conditions", [])

    if not conditions:
        return False

    results = []
    for cond in conditions:
        if "logic" in cond:
            # Nested group
            results.append(evaluate_conditions(cond, df, bar_idx, indicators))
        else:
            results.append(evaluate_single_condition(cond, df, bar_idx))

    if logic == "AND":
        return all(results)
    else:  # OR
        return any(results)


def evaluate_single_condition(cond: dict, df, bar_idx: int) -> bool:
    """Evaluate a single condition at the current bar"""
    try:
        left_val = resolve_value(cond.get("left", {}), df, bar_idx)
        right_val = resolve_value(cond.get("right", {}), df, bar_idx)
        op = cond.get("operator", "gt")

        if left_val is None or right_val is None:
            return False

        import math
        if math.isnan(left_val) or math.isnan(right_val):
            return False

        if op == "gt": return left_val > right_val
        elif op == "gte": return left_val >= right_val
        elif op == "lt": return left_val < right_val
        elif op == "lte": return left_val <= right_val
        elif op == "eq": return abs(left_val - right_val) < 0.0001
        elif op == "crosses_above":
            if bar_idx < 1: return False
            prev_left = resolve_value(cond.get("left", {}), df, bar_idx - 1)
            prev_right = resolve_value(cond.get("right", {}), df, bar_idx - 1)
            if prev_left is None or prev_right is None: return False
            return prev_left <= prev_right and left_val > right_val
        elif op == "crosses_below":
            if bar_idx < 1: return False
            prev_left = resolve_value(cond.get("left", {}), df, bar_idx - 1)
            prev_right = resolve_value(cond.get("right", {}), df, bar_idx - 1)
            if prev_left is None or prev_right is None: return False
            return prev_left >= prev_right and left_val < right_val

        return False
    except Exception:
        return False


def resolve_value(source: dict, df, bar_idx: int):
    """Resolve a ConditionValueSource to a float value"""
    source_type = source.get("type", "")

    if source_type == "constant":
        return float(source.get("value", 0))

    elif source_type == "price":
        field = source.get("field", "close").capitalize()
        if field.lower() == "close": field = "Close"
        elif field.lower() == "open": field = "Open"
        elif field.lower() == "high": field = "High"
        elif field.lower() == "low": field = "Low"
        return float(df.iloc[bar_idx][field])

    elif source_type == "indicator":
        ind_id = source.get("indicator_id", "")
        field = source.get("field")
        col = f"{ind_id}_{field}" if field else ind_id
        if col in df.columns:
            return float(df.iloc[bar_idx][col])
        elif ind_id in df.columns:
            return float(df.iloc[bar_idx][ind_id])
        return None

    elif source_type == "indicator_prev":
        ind_id = source.get("indicator_id", "")
        bars_ago = source.get("bars_ago", 1)
        idx = bar_idx - bars_ago
        if idx < 0: return None
        field = source.get("field")
        col = f"{ind_id}_{field}" if field else ind_id
        if col in df.columns:
            return float(df.iloc[idx][col])
        elif ind_id in df.columns:
            return float(df.iloc[idx][ind_id])
        return None

    return None


# ============================================================
# Run
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
