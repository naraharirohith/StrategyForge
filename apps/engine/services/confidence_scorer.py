"""
Confidence scoring service for StrategyForge backtesting engine.

Computes a live 0-100 confidence score for a strategy given current market
conditions. Combines four components: backtest strength, regime fit,
signal proximity, and volatility context.
"""

from .indicator_calculator import IndicatorCalculator
from .condition_evaluator import evaluate_conditions, estimate_condition_proximity, resolve_value


class ConfidenceScorer:
    """
    Computes a live 0-100 confidence score for a strategy given current market conditions.

    Components:
      - Backtest Strength  (40%): historical score from latest backtest
      - Regime Fit         (30%): current market regime vs strategy's preferred regime
      - Signal Proximity   (20%): how close entry conditions are to triggering right now
      - Volatility Context (10%): current VIX / realized vol vs strategy's tested range
    """

    # How well each strategy style performs in each regime (0-100)
    STYLE_REGIME_FIT = {
        "momentum":       {"bull": 90, "sideways": 30, "bear": 10},
        "mean_reversion": {"bull": 40, "sideways": 90, "bear": 60},
        "swing":          {"bull": 75, "sideways": 65, "bear": 30},
        "positional":     {"bull": 80, "sideways": 50, "bear": 20},
        "intraday":       {"bull": 70, "sideways": 70, "bear": 50},
        "portfolio":      {"bull": 75, "sideways": 60, "bear": 40},
        "hybrid":         {"bull": 65, "sideways": 65, "bear": 45},
    }

    @staticmethod
    def detect_regime(ticker: str) -> dict:
        """Classify the current market regime for a ticker using last 12 months of daily data."""
        import yfinance as yf
        import numpy as np
        import pandas as pd

        try:
            data = yf.download(ticker, period="1y", interval="1d", progress=False, auto_adjust=True)
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)
            if data.empty or len(data) < 60:
                return {"regime": "unknown", "adx": 0, "price": 0, "return_20d": 0}

            close = data["Close"]
            high  = data["High"]
            low   = data["Low"]

            ema_50  = close.ewm(span=50,  adjust=False).mean()
            ema_200 = close.ewm(span=200, adjust=False).mean()

            # ADX
            plus_dm  = high.diff()
            minus_dm = -low.diff()
            plus_dm  = plus_dm.where((plus_dm > minus_dm) & (plus_dm > 0), 0)
            minus_dm = minus_dm.where((minus_dm > plus_dm) & (minus_dm > 0), 0)
            tr = pd.concat([
                high - low,
                (high - close.shift()).abs(),
                (low  - close.shift()).abs(),
            ], axis=1).max(axis=1)
            atr14    = tr.rolling(14).mean()
            plus_di  = 100 * (plus_dm.rolling(14).mean() / atr14)
            minus_di = 100 * (minus_dm.rolling(14).mean() / atr14)
            dx       = 100 * ((plus_di - minus_di).abs() / (plus_di + minus_di))
            adx      = dx.rolling(14).mean()

            current_price  = float(close.iloc[-1])
            current_ema200 = float(ema_200.iloc[-1])
            current_adx    = float(adx.iloc[-1]) if not np.isnan(adx.iloc[-1]) else 20
            ret_20d = float((close.iloc[-1] / close.iloc[-21] - 1) * 100) if len(close) > 21 else 0

            if current_adx < 20:
                regime = "sideways"
            elif current_price > current_ema200 and ret_20d > 0:
                regime = "bull"
            elif current_price < current_ema200 and ret_20d < 0:
                regime = "bear"
            elif current_price > current_ema200:
                regime = "bull"
            else:
                regime = "bear"

            return {
                "regime": regime,
                "adx": round(current_adx, 1),
                "ema_50": round(float(ema_50.iloc[-1]), 2),
                "ema_200": round(current_ema200, 2),
                "price": round(current_price, 2),
                "return_20d": round(ret_20d, 2),
            }
        except Exception as e:
            print(f"Regime detection failed for {ticker}: {e}")
            return {"regime": "unknown", "adx": 0, "price": 0, "return_20d": 0}

    @staticmethod
    def get_volatility_context(ticker: str, market: str) -> dict:
        """Fetch VIX and realized volatility to assess current vol environment."""
        import yfinance as yf
        import numpy as np
        import pandas as pd

        india_vix = None
        us_vix    = None

        # India VIX
        try:
            d = yf.download("^INDIAVIX", period="5d", interval="1d", progress=False, auto_adjust=True)
            if isinstance(d.columns, pd.MultiIndex):
                d.columns = d.columns.get_level_values(0)
            if not d.empty:
                india_vix = round(float(d["Close"].iloc[-1]), 2)
        except Exception:
            pass

        # US VIX (always useful for global context)
        try:
            d = yf.download("^VIX", period="5d", interval="1d", progress=False, auto_adjust=True)
            if isinstance(d.columns, pd.MultiIndex):
                d.columns = d.columns.get_level_values(0)
            if not d.empty:
                us_vix = round(float(d["Close"].iloc[-1]), 2)
        except Exception:
            pass

        # Realized vol from ticker
        realized_vol = 20.0
        try:
            d = yf.download(ticker, period="60d", interval="1d", progress=False, auto_adjust=True)
            if isinstance(d.columns, pd.MultiIndex):
                d.columns = d.columns.get_level_values(0)
            if not d.empty:
                rets = d["Close"].pct_change().dropna()
                realized_vol = round(float(np.std(rets) * np.sqrt(252) * 100), 1)
        except Exception:
            pass

        # Use India VIX for IN market, US VIX otherwise
        active_vix = india_vix if market == "IN" else us_vix
        vix_for_level = active_vix or 20.0

        if vix_for_level < 15:
            level = "low"
        elif vix_for_level < 25:
            level = "normal"
        elif vix_for_level < 35:
            level = "elevated"
        else:
            level = "extreme"

        return {
            "india_vix": india_vix,
            "us_vix": us_vix,
            "realized_vol_annual": realized_vol,
            "level": level,
        }

    @staticmethod
    def get_global_risk(market: str) -> dict:
        """Fetch key global macro signals: S&P500, crude oil, USD/INR."""
        import yfinance as yf
        import pandas as pd

        signals: dict = {}

        try:
            d = yf.download("^GSPC", period="10d", interval="1d", progress=False, auto_adjust=True)
            if isinstance(d.columns, pd.MultiIndex):
                d.columns = d.columns.get_level_values(0)
            if len(d) >= 5:
                ret = float((d["Close"].iloc[-1] / d["Close"].iloc[-5] - 1) * 100)
                signals["sp500_5d_return"] = round(ret, 2)
                signals["sp500_trend"] = "up" if ret > 0.5 else "down" if ret < -0.5 else "flat"
        except Exception:
            pass

        try:
            d = yf.download("CL=F", period="10d", interval="1d", progress=False, auto_adjust=True)
            if isinstance(d.columns, pd.MultiIndex):
                d.columns = d.columns.get_level_values(0)
            if len(d) >= 5:
                ret = float((d["Close"].iloc[-1] / d["Close"].iloc[-5] - 1) * 100)
                signals["crude_5d_return"] = round(ret, 2)
                signals["crude_trend"] = "up" if ret > 2 else "down" if ret < -2 else "stable"
        except Exception:
            pass

        if market == "IN":
            try:
                d = yf.download("INR=X", period="10d", interval="1d", progress=False, auto_adjust=True)
                if isinstance(d.columns, pd.MultiIndex):
                    d.columns = d.columns.get_level_values(0)
                if len(d) >= 5:
                    ret = float((d["Close"].iloc[-1] / d["Close"].iloc[-5] - 1) * 100)
                    signals["usdinr_5d_change"] = round(ret, 2)
                    signals["inr_pressure"] = "weakening" if ret > 0.5 else "stable" if ret > -0.5 else "strengthening"
            except Exception:
                pass

        return signals

    @staticmethod
    def compute_signal_proximity(strategy: dict) -> dict:
        """
        Assess how close the strategy's entry conditions are to triggering right now.
        Returns score 0-100 (100 = signal is live).
        """
        import yfinance as yf
        import numpy as np
        import pandas as pd

        tickers    = strategy.get("universe", {}).get("tickers", [])
        indicators = strategy.get("indicators", [])
        entry_rules = strategy.get("entry_rules", [])

        if not tickers or not entry_rules:
            return {"score": 50, "triggered": False, "description": "No entry rules to evaluate", "nearest_signal": "N/A", "condition_hints": []}

        ticker = tickers[0]

        try:
            data = yf.download(ticker, period="120d", interval="1d", progress=False, auto_adjust=True)
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)
            if data.empty or len(data) < 30:
                return {"score": 50, "triggered": False, "description": "Insufficient recent data", "nearest_signal": "N/A", "condition_hints": []}

            df = IndicatorCalculator.compute(data.copy(), indicators)
            df = df.dropna()
            if len(df) < 2:
                return {"score": 50, "triggered": False, "description": "Insufficient data after indicators", "nearest_signal": "N/A", "condition_hints": []}

            last_idx = len(df) - 1
            best_score = 0
            best_desc  = ""
            any_triggered = False
            hints = []

            for rule in entry_rules:
                triggered = evaluate_conditions(rule.get("conditions", {}), df, last_idx, indicators)
                rule_name = rule.get("name", "Entry")
                if triggered:
                    any_triggered = True
                    best_score = 95
                    best_desc  = f"'{rule_name}' signal is ACTIVE now"
                else:
                    proximities = estimate_condition_proximity(rule.get("conditions", {}), df, last_idx)
                    if proximities:
                        avg = float(np.mean(proximities))
                        if avg > best_score:
                            best_score = avg
                            pct_away = round(100 - avg)
                            best_desc = f"'{rule_name}': ~{pct_away}% away from trigger"

                conditions_group = rule.get("conditions", {})
                flat_conditions = conditions_group.get("conditions", [])
                rule_triggered = triggered

                for cond in flat_conditions:
                    if "logic" in cond:
                        continue  # skip nested groups for now
                    left_spec = cond.get("left", {})
                    right_spec = cond.get("right", {})
                    op = cond.get("operator", "?")

                    try:
                        import math
                        left_val = resolve_value(left_spec, df, last_idx)
                        right_val = resolve_value(right_spec, df, last_idx)
                        if left_val is None or right_val is None:
                            continue
                        if isinstance(left_val, float) and math.isnan(left_val):
                            continue
                        if isinstance(right_val, float) and math.isnan(right_val):
                            continue
                    except Exception:
                        continue

                    # Build human-readable label for left side
                    if left_spec.get("type") == "indicator":
                        ind_id = left_spec.get("indicator_id", "")
                        ind_def = next((i for i in indicators if i.get("id") == ind_id), {})
                        ind_type = ind_def.get("type", ind_id)
                        params = ind_def.get("params", {})
                        period = params.get("period", "")
                        label = f"{ind_type}({period})" if period else ind_type
                    elif left_spec.get("type") == "price":
                        label = "Price"
                    else:
                        label = str(left_spec.get("type", "Indicator"))

                    # Build target label
                    if right_spec.get("type") == "indicator":
                        ind_id2 = right_spec.get("indicator_id", "")
                        ind_def2 = next((i for i in indicators if i.get("id") == ind_id2), {})
                        ind_type2 = ind_def2.get("type", ind_id2)
                        params2 = ind_def2.get("params", {})
                        period2 = params2.get("period", "")
                        target_label = f"{ind_type2}({period2})" if period2 else ind_type2
                    else:
                        target_label = None

                    op_labels = {
                        "gt": ">", "gte": "≥", "lt": "<", "lte": "≤",
                        "eq": "=", "crosses_above": "↑ cross", "crosses_below": "↓ cross",
                    }

                    hints.append({
                        "label": label,
                        "current": round(float(left_val), 2),
                        "target": round(float(right_val), 2),
                        "target_label": target_label,
                        "op": op_labels.get(op, op),
                        "met": rule_triggered,
                    })

            if not best_desc:
                best_desc = "Could not evaluate entry conditions"

            return {
                "score": round(best_score, 1),
                "triggered": any_triggered,
                "description": best_desc,
                "nearest_signal": best_desc,
                "condition_hints": hints,
            }
        except Exception as e:
            print(f"Signal proximity failed: {e}")
            return {"score": 50, "triggered": False, "description": "Evaluation error", "nearest_signal": "N/A"}

    @classmethod
    def compute(cls, strategy: dict, latest_backtest: dict) -> dict:
        """
        Compute the full confidence score for a strategy.

        Args:
            strategy: Full strategy definition dict.
            latest_backtest: BacktestResult from previous run.

        Returns:
            Dict with overall score, recommendation, reasoning, component breakdown,
            and global risk signals.
        """
        import numpy as np

        style   = strategy.get("style", "hybrid")
        universe = strategy.get("universe", {})
        market  = str(universe.get("market", "US")).upper()
        tickers = universe.get("tickers", [])
        primary = tickers[0] if tickers else ("^NSEI" if market == "IN" else "SPY")

        # --- Component 1: Backtest Strength (40%) ---
        bt_score   = latest_backtest.get("score", {}).get("overall", 50)
        bt_strength = float(bt_score)

        # --- Component 2: Regime Fit (30%) ---
        regime_ticker = "^NSEI" if market == "IN" else "SPY"
        regime_info   = cls.detect_regime(regime_ticker)
        current_regime = regime_info.get("regime", "unknown")
        style_fits    = cls.STYLE_REGIME_FIT.get(style, {"bull": 65, "sideways": 65, "bear": 45})
        preferred_regime = max(style_fits, key=style_fits.get)
        regime_score  = float(style_fits.get(current_regime, 50))

        # --- Component 3: Signal Proximity (20%) ---
        signal_info    = cls.compute_signal_proximity(strategy)
        signal_score   = float(signal_info.get("score", 50))

        # --- Component 4: Volatility Context (10%) ---
        vol_info  = cls.get_volatility_context(primary, market)
        vol_level = vol_info.get("level", "normal")
        vol_score = {"low": 70, "normal": 85, "elevated": 50, "extreme": 20}.get(vol_level, 70)

        # --- Global risk signals (informational, not scored) ---
        global_risk = cls.get_global_risk(market)

        # --- Composite ---
        overall = round(min(100.0, max(0.0,
            bt_strength * 0.40 +
            regime_score * 0.30 +
            signal_score * 0.20 +
            vol_score    * 0.10
        )), 1)

        if overall >= 75:
            recommendation = "buy"
            rec_label = "Favorable"
        elif overall >= 55:
            recommendation = "hold"
            rec_label = "Neutral"
        elif overall >= 35:
            recommendation = "reduce"
            rec_label = "Cautious"
        else:
            recommendation = "exit"
            rec_label = "Unfavorable"

        # --- Build plain-English reasoning ---
        parts = []
        if current_regime != "unknown":
            parts.append(f"market is in a {current_regime} regime (ADX {regime_info.get('adx', '?')})")
        if current_regime != preferred_regime:
            parts.append(f"this {style.replace('_', ' ')} strategy performs best in {preferred_regime} markets")
        if signal_info.get("triggered"):
            parts.append("an entry signal is ACTIVE right now")
        elif signal_info.get("description"):
            parts.append(signal_info["description"].lower())
        if vol_level in ("elevated", "extreme"):
            vix = vol_info.get("india_vix") or vol_info.get("us_vix")
            vix_str = f" (VIX {vix})" if vix else ""
            parts.append(f"volatility is {vol_level}{vix_str} -- consider smaller position size")
        sp_trend = global_risk.get("sp500_trend")
        if sp_trend and sp_trend != "flat":
            parts.append(f"S&P 500 is trending {sp_trend} over the past week")

        reasoning = (". ".join(parts).capitalize() + ".") if parts else "Insufficient data to generate reasoning."

        return {
            "overall": overall,
            "recommendation": recommendation,
            "recommendation_label": rec_label,
            "reasoning": reasoning,
            "components": {
                "backtest_strength": {
                    "score": round(bt_strength, 1),
                    "weight": 0.40,
                    "description": f"Historical backtest score: {bt_score}/100",
                },
                "regime_fit": {
                    "score": round(regime_score, 1),
                    "weight": 0.30,
                    "current_regime": current_regime,
                    "preferred_regime": preferred_regime,
                    "description": f"Current: {current_regime} | Prefers: {preferred_regime}",
                    "regime_info": regime_info,
                },
                "signal_proximity": {
                    "score": round(signal_score, 1),
                    "weight": 0.20,
                    "triggered": signal_info.get("triggered", False),
                    "description": signal_info.get("description", ""),
                    "nearest_signal": signal_info.get("nearest_signal", ""),
                    "condition_hints": signal_info.get("condition_hints", []),
                },
                "volatility_context": {
                    "score": round(float(vol_score), 1),
                    "weight": 0.10,
                    "level": vol_level,
                    "india_vix": vol_info.get("india_vix"),
                    "us_vix": vol_info.get("us_vix"),
                    "realized_vol": vol_info.get("realized_vol_annual"),
                    "description": f"Volatility: {vol_level}",
                },
            },
            "global_risk": global_risk,
        }
