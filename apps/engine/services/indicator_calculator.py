"""
Technical indicator calculator for StrategyForge backtesting engine.

Computes a wide range of technical indicators (SMA, EMA, RSI, MACD, BBANDS,
ATR, ADX, Supertrend, Keltner Channels, Parabolic SAR, etc.) and adds them
as columns to the OHLCV DataFrame.

Bug fixes applied:
- RSI now uses Wilder's exponential smoothing (EWM with alpha=1/period)
  instead of simple rolling mean.
- KELTNER channels fully implemented (was a stub).
- Parabolic SAR (PSAR) fully implemented (was a stub).
"""


class IndicatorCalculator:
    """Computes technical indicators and adds them as columns to the DataFrame."""

    SUPPORTED = [
        "SMA", "EMA", "WMA", "VWAP",
        "RSI", "MACD", "STOCH", "CCI", "WILLIAMS_R", "MFI",
        "BBANDS", "ATR", "KELTNER", "DONCHIAN",
        "OBV", "VOLUME_SMA",
        "ADX", "SUPERTREND", "PSAR", "ICHIMOKU",
        "PRICE_CHANGE_PCT", "HIGH_LOW_RANGE", "GAP",
    ]

    @staticmethod
    def compute(df, indicators: list[dict]):
        """
        Add indicator columns to DataFrame.

        Each indicator config: { id, type, params, apply_to }

        Args:
            df: pandas DataFrame with OHLCV columns.
            indicators: List of indicator configuration dicts.

        Returns:
            The same DataFrame with indicator columns added.
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
                    # Bug fix: Use Wilder's exponential smoothing (EWM with alpha=1/period)
                    # instead of simple rolling mean for proper RSI calculation.
                    period = int(params.get("period", 14))
                    delta = df[source].diff()
                    gain = delta.where(delta > 0, 0).ewm(alpha=1/period, min_periods=period, adjust=False).mean()
                    loss = (-delta.where(delta < 0, 0)).ewm(alpha=1/period, min_periods=period, adjust=False).mean()
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

                    atr = tr.ewm(alpha=1/period, min_periods=period, adjust=False).mean()
                    plus_di = 100 * (plus_dm.ewm(alpha=1/period, min_periods=period, adjust=False).mean() / atr.replace(0, np.nan))
                    minus_di = 100 * (minus_dm.ewm(alpha=1/period, min_periods=period, adjust=False).mean() / atr.replace(0, np.nan))
                    dx = 100 * ((plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan))
                    df[f"{ind_id}_plus_di"] = plus_di
                    df[f"{ind_id}_minus_di"] = minus_di
                    df[ind_id] = dx.ewm(alpha=1/period, min_periods=period, adjust=False).mean()

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

                elif ind_type == "DONCHIAN":
                    period = int(params.get("period", 20))
                    df[f"{ind_id}_upper"] = df["High"].rolling(window=period).max()
                    df[f"{ind_id}_lower"] = df["Low"].rolling(window=period).min()
                    df[f"{ind_id}_middle"] = (df[f"{ind_id}_upper"] + df[f"{ind_id}_lower"]) / 2
                    df[ind_id] = df[f"{ind_id}_upper"]  # default reference = upper band

                elif ind_type == "WMA":
                    period = int(params.get("period", 20))
                    weights = np.arange(1, period + 1, dtype=float)
                    df[ind_id] = df[source].rolling(window=period).apply(
                        lambda x: np.dot(x, weights) / weights.sum(), raw=True
                    )

                elif ind_type == "VWAP":
                    typical = (df["High"] + df["Low"] + df["Close"]) / 3
                    df[ind_id] = (typical * df["Volume"]).cumsum() / df["Volume"].cumsum()

                elif ind_type == "CCI":
                    period = int(params.get("period", 20))
                    typical = (df["High"] + df["Low"] + df["Close"]) / 3
                    sma = typical.rolling(window=period).mean()
                    mad = typical.rolling(window=period).apply(lambda x: np.abs(x - x.mean()).mean(), raw=True)
                    df[ind_id] = (typical - sma) / (0.015 * mad)

                elif ind_type == "WILLIAMS_R":
                    period = int(params.get("period", 14))
                    highest_high = df["High"].rolling(window=period).max()
                    lowest_low = df["Low"].rolling(window=period).min()
                    df[ind_id] = -100 * (highest_high - df["Close"]) / (highest_high - lowest_low)

                elif ind_type == "MFI":
                    period = int(params.get("period", 14))
                    typical = (df["High"] + df["Low"] + df["Close"]) / 3
                    raw_mf = typical * df["Volume"]
                    pos_mf = raw_mf.where(typical > typical.shift(1), 0).rolling(window=period).sum()
                    neg_mf = raw_mf.where(typical < typical.shift(1), 0).rolling(window=period).sum()
                    df[ind_id] = 100 - (100 / (1 + pos_mf / neg_mf.replace(0, np.nan)))

                elif ind_type == "HIGH_LOW_RANGE":
                    period = int(params.get("period", 20))
                    df[ind_id] = df["High"].rolling(window=period).max() - df["Low"].rolling(window=period).min()

                elif ind_type == "KELTNER":
                    # Bug fix: Full Keltner Channels implementation (was a stub).
                    period = int(params.get("period", 20))
                    multiplier = float(params.get("multiplier", 1.5))
                    ema = df[source].ewm(span=period, adjust=False).mean()
                    high_low = df["High"] - df["Low"]
                    high_close = (df["High"] - df["Close"].shift()).abs()
                    low_close = (df["Low"] - df["Close"].shift()).abs()
                    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
                    atr = tr.rolling(window=period).mean()
                    df[f"{ind_id}_upper"] = ema + (multiplier * atr)
                    df[f"{ind_id}_middle"] = ema
                    df[f"{ind_id}_lower"] = ema - (multiplier * atr)
                    df[ind_id] = ema

                elif ind_type == "PSAR":
                    # Bug fix: Full Parabolic SAR implementation (was a stub).
                    af_start = float(params.get("af_start", 0.02))
                    af_step = float(params.get("af_step", 0.02))
                    af_max = float(params.get("af_max", 0.2))

                    high = df["High"].values
                    low = df["Low"].values
                    close = df["Close"].values
                    length = len(df)

                    psar = np.full(length, np.nan)
                    direction = np.ones(length)  # 1 = bull, -1 = bear
                    af = af_start
                    ep = low[0]
                    psar[0] = high[0]

                    for j in range(1, length):
                        if direction[j-1] == 1:  # bullish
                            psar[j] = psar[j-1] + af * (ep - psar[j-1])
                            psar[j] = min(psar[j], low[j-1], low[j-2] if j >= 2 else low[j-1])
                            if low[j] < psar[j]:
                                direction[j] = -1
                                psar[j] = ep
                                af = af_start
                                ep = low[j]
                            else:
                                direction[j] = 1
                                if high[j] > ep:
                                    ep = high[j]
                                    af = min(af + af_step, af_max)
                        else:  # bearish
                            psar[j] = psar[j-1] + af * (ep - psar[j-1])
                            psar[j] = max(psar[j], high[j-1], high[j-2] if j >= 2 else high[j-1])
                            if high[j] > psar[j]:
                                direction[j] = 1
                                psar[j] = ep
                                af = af_start
                                ep = high[j]
                            else:
                                direction[j] = -1
                                if low[j] < ep:
                                    ep = low[j]
                                    af = min(af + af_step, af_max)

                    df[ind_id] = psar
                    df[f"{ind_id}_direction"] = direction

                elif ind_type == "ICHIMOKU":
                    tenkan_period = int(params.get("tenkan", 9))
                    kijun_period = int(params.get("kijun", 26))
                    senkou_b_period = int(params.get("senkou_b", 52))

                    # Tenkan-sen (Conversion Line)
                    tenkan_high = df["High"].rolling(window=tenkan_period).max()
                    tenkan_low = df["Low"].rolling(window=tenkan_period).min()
                    df[f"{ind_id}_tenkan"] = (tenkan_high + tenkan_low) / 2

                    # Kijun-sen (Base Line)
                    kijun_high = df["High"].rolling(window=kijun_period).max()
                    kijun_low = df["Low"].rolling(window=kijun_period).min()
                    df[f"{ind_id}_kijun"] = (kijun_high + kijun_low) / 2

                    # Senkou Span A (Leading Span A)
                    df[f"{ind_id}_senkou_a"] = ((df[f"{ind_id}_tenkan"] + df[f"{ind_id}_kijun"]) / 2).shift(kijun_period)

                    # Senkou Span B (Leading Span B)
                    senkou_b_high = df["High"].rolling(window=senkou_b_period).max()
                    senkou_b_low = df["Low"].rolling(window=senkou_b_period).min()
                    df[f"{ind_id}_senkou_b"] = ((senkou_b_high + senkou_b_low) / 2).shift(kijun_period)

                    # Chikou Span (Lagging Span)
                    df[f"{ind_id}_chikou"] = df["Close"].shift(-kijun_period)

                    # Default reference = Tenkan-sen
                    df[ind_id] = df[f"{ind_id}_tenkan"]

                elif ind_type == "GAP":
                    # WARNING: GAP indicator is intentionally kept as a stub.
                    # A proper implementation requires session-aware gap detection
                    # (overnight gaps, weekend gaps, holiday gaps) which depends on
                    # exchange calendars and is complex to implement correctly.
                    # Using Close as placeholder so conditions can still reference the id.
                    df[ind_id] = df["Close"]
                    print(f"Warning: GAP indicator not fully implemented -- using Close as placeholder")

                else:
                    # Truly unknown -- use Close as placeholder so dropna doesn't wipe all rows
                    df[ind_id] = df["Close"]
                    print(f"Warning: Unknown indicator type '{ind_type}' for {ind_id} -- using Close as placeholder")

            except Exception as e:
                df[ind_id] = float("nan")
                print(f"Warning: Failed to compute {ind_id} ({ind_type}): {e}")

        return df
