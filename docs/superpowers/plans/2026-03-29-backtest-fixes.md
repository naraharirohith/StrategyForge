# Backtest Engine Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three confirmed bugs in the backtest engine: missing drawdown halt in single-ticker mode, unimplemented `equal_weight` position sizing, and wasteful/confusing 0-trade result handling.

**Architecture:** All changes are in the Python engine (`apps/engine/`). Single-ticker and multi-ticker backtesting share helper functions (`_open_position`, `_check_exits`) but have separate core loops. Changes stay in `backtester.py` and `main.py` — no new files needed.

**Tech Stack:** Python 3.11, FastAPI, pandas, numpy, pytest

---

## What's Actually Broken (verified from code)

| Bug | Location | Status |
|-----|----------|--------|
| `max_portfolio_drawdown_percent` ignored in single-ticker | `_run_backtest_core` | `peak_equity` tracked but never checked |
| `equal_weight` sizing silently falls to 10% | `_open_position` | Falls through to `else: alloc = capital * 0.1` |
| 0-trade result runs expensive metrics anyway | `_compute_backtest_metrics` in `main.py` | Walk-forward + alpha/beta fetch even when trades=[] |

**What's already correct (don't touch):**
- Multi-ticker drawdown halt ✅
- Multi-ticker `max_position_count` ✅
- `percent_risk`, `volatility_adjusted`, `fixed_amount` sizing ✅
- Cache TTL per timeframe ✅

---

## File Map

| File | What changes |
|------|-------------|
| `apps/engine/services/backtester.py` | Task 1 + Task 2: add drawdown halt to `_run_backtest_core`; add `equal_weight` branch + `max_positions` param to `_open_position` |
| `apps/engine/main.py` | Task 3: skip expensive metrics + add clear warning when trades=0 |
| `apps/engine/tests/test_backtest_engine.py` | All tasks: add tests for each fix |

---

## Task 1: Single-ticker drawdown halt

**Files:**
- Modify: `apps/engine/services/backtester.py` — `_run_backtest_core` function (lines 172–257)
- Test: `apps/engine/tests/test_backtest_engine.py`

The single-ticker loop tracks `peak_equity` but never reads `max_portfolio_drawdown_percent` from the strategy. The multi-ticker loop already handles this correctly — we mirror that logic.

- [ ] **Step 1: Write the failing test**

Add to `apps/engine/tests/test_backtest_engine.py`:

```python
def test_single_ticker_drawdown_halt():
    """
    Single-ticker backtest must stop entering trades once max_portfolio_drawdown_percent is breached.
    Strategy: always-true entry, tight drawdown limit of 1% so it halts immediately.
    """
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    import pandas as pd
    import numpy as np
    from services.backtester import run_backtest

    # Declining price series — any long position loses money
    np.random.seed(0)
    n = 200
    dates = pd.date_range("2022-01-01", periods=n, freq="B")
    close = 100.0 * np.exp(np.cumsum(np.full(n, -0.005)))  # steady decline
    df = pd.DataFrame({
        "Open": close, "High": close * 1.001,
        "Low": close * 0.999, "Close": close, "Volume": 1_000_000.0,
    }, index=dates)

    # Always-true entry (RSI always exists)
    from services.indicator_calculator import IndicatorCalculator
    indicators = [{"id": "rsi_14", "type": "RSI", "params": {"period": 14}}]
    df = IndicatorCalculator.compute(df, indicators).iloc[20:]

    strategy = {
        "schema_version": "1.0.0", "name": "T", "description": "T",
        "style": "momentum", "risk_level": "moderate",
        "universe": {"market": "US", "asset_class": "equity", "tickers": ["T"]},
        "timeframe": "1d", "indicators": indicators,
        "entry_rules": [{
            "id": "e1", "name": "Always Enter", "side": "long",
            "conditions": {"logic": "AND", "conditions": [
                {"id": "c1", "left": {"type": "indicator", "indicator_id": "rsi_14"},
                 "operator": "gt", "right": {"type": "constant", "value": 0}},
            ]},
            "position_sizing": {"method": "percent_of_portfolio", "percent": 50},
        }],
        "exit_rules": [
            {"id": "x1", "name": "SL", "type": "stop_loss", "value": 50, "priority": 1},
        ],
        # 1% max drawdown — should halt very early
        "risk_management": {"max_portfolio_drawdown_percent": 1, "max_position_count": 1},
        "backtest_config": {
            "initial_capital": 100_000, "currency": "USD",
            "commission_percent": 0.0, "slippage_percent": 0.0,
        },
    }

    result = run_backtest(
        df=df, strategy=strategy, primary_ticker="T",
        initial_capital=100_000, commission=0.0, slippage=0.0,
        indicators=indicators,
    )
    trades = result["trades"]
    # With a 1% drawdown limit on a declining series, should stop after 1-2 trades
    # Crucially: must be fewer trades than there are bars
    assert len(trades) < 10, f"Expected drawdown halt to stop trading early, got {len(trades)} trades"
    assert len(trades) >= 1, "Expected at least one trade before halt"
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd apps/engine && source venv/Scripts/activate 2>/dev/null || source venv/bin/activate
python -m pytest tests/test_backtest_engine.py::test_single_ticker_drawdown_halt -v
```

Expected: FAIL — test finds `len(trades) >= 10` because the halt never triggers.

- [ ] **Step 3: Implement the fix in `_run_backtest_core`**

In `apps/engine/services/backtester.py`, update `_run_backtest_core`:

```python
def _run_backtest_core(
    df,
    strategy: dict,
    primary_ticker: str,
    initial_capital: float,
    commission: float,
    slippage: float,
    indicators: list,
) -> dict:
    capital = initial_capital
    position = None
    trades = []
    equity_curve = []
    peak_equity = initial_capital
    drawdown_halt = False  # NEW

    # NEW: read drawdown limit from strategy
    risk_mgmt = strategy.get("risk_management", {})
    max_drawdown_pct = risk_mgmt.get("max_portfolio_drawdown_percent", 100)

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

        # NEW: check portfolio drawdown halt
        if peak_equity > 0:
            current_dd = ((current_equity - peak_equity) / peak_equity) * 100
            if current_dd <= -max_drawdown_pct:
                drawdown_halt = True

        # --- Check exits first ---
        if position:
            exit_triggered, exit_reason = _check_exits(
                position, exit_rules, current_price, i, df=df, indicators=indicators
            )

            # NEW: force close if drawdown halted
            if drawdown_halt and not exit_triggered:
                exit_triggered = True
                exit_reason = "max_drawdown"

            if exit_triggered:
                trade, pnl = _close_position(
                    position, primary_ticker, current_price, current_date,
                    i, slippage, commission
                )
                trades.append(trade)
                capital += pnl
                position = None

        # NEW: skip entries if drawdown halted
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
                        df=df, bar_idx=i,
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
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
python -m pytest tests/test_backtest_engine.py::test_single_ticker_drawdown_halt -v
```

Expected: PASS

- [ ] **Step 5: Run full test suite**

```bash
python -m pytest tests/ -v --tb=short -q
```

Expected: all 85 tests pass (now 86 with new test).

- [ ] **Step 6: Commit**

```bash
git add apps/engine/services/backtester.py apps/engine/tests/test_backtest_engine.py
git commit -m "fix: enforce max_portfolio_drawdown_percent in single-ticker backtest"
```

---

## Task 2: Implement `equal_weight` position sizing

**Files:**
- Modify: `apps/engine/services/backtester.py` — `_open_position` function (lines 510–564) and `_run_backtest_core` caller (lines 238–245)
- Test: `apps/engine/tests/test_backtest_engine.py`

`equal_weight` divides capital equally across `max_position_count` positions. In single-ticker that's always 1, so alloc = capital. We pass `max_positions` into `_open_position` as an optional kwarg (default 1) so the function can compute equal-weight allocation correctly.

- [ ] **Step 1: Write the failing test**

Add to `apps/engine/tests/test_backtest_engine.py`:

```python
def test_equal_weight_position_sizing():
    """
    equal_weight with max_position_count=4 should allocate capital/4 per position,
    not the 10% fallback.
    """
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    import pandas as pd
    import numpy as np
    from services.backtester import _open_position

    # Build a minimal df with ATR column present (needed for some sizing methods)
    np.random.seed(1)
    n = 50
    dates = pd.date_range("2022-01-01", periods=n, freq="B")
    close = np.full(n, 100.0)
    df = pd.DataFrame({
        "Open": close, "High": close * 1.01, "Low": close * 0.99,
        "Close": close, "Volume": 1_000_000.0,
    }, index=dates)

    rule = {
        "id": "e1", "side": "long",
        "position_sizing": {"method": "equal_weight"},
    }
    capital = 100_000.0
    max_positions = 4

    pos = _open_position(
        rule=rule, available_capital=capital, current_price=100.0,
        current_date="2022-01-03", entry_idx=2,
        slippage=0.0, commission=0.0,
        df=df, bar_idx=2, max_positions=max_positions,
    )

    expected_alloc = capital / max_positions  # 25_000
    actual_alloc = pos["size"] * pos["entry_price"]
    assert abs(actual_alloc - expected_alloc) < 1.0, (
        f"equal_weight should allocate {expected_alloc:.0f} but got {actual_alloc:.0f}"
    )
```

- [ ] **Step 2: Run to confirm it fails**

```bash
python -m pytest tests/test_backtest_engine.py::test_equal_weight_position_sizing -v
```

Expected: FAIL — `_open_position` doesn't accept `max_positions` kwarg.

- [ ] **Step 3: Add `max_positions` parameter and `equal_weight` branch to `_open_position`**

In `apps/engine/services/backtester.py`, update `_open_position` signature and add the branch:

```python
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
    max_positions: int = 1,          # NEW parameter
) -> dict:
    """Create a new position dict from an entry rule."""
    side = rule.get("side", "long")
    sizing = rule.get("position_sizing", {"method": "percent_of_portfolio", "percent": 10})
    current_bar_idx = entry_idx if bar_idx is None else bar_idx

    if sizing["method"] == "percent_of_portfolio":
        alloc = available_capital * (sizing.get("percent", 10) / 100)
    elif sizing["method"] == "fixed_amount":
        alloc = min(sizing.get("amount", 10000), available_capital * 0.95)
    elif sizing["method"] == "equal_weight":           # NEW branch
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
```

- [ ] **Step 4: Pass `max_positions` from `_run_backtest_core` caller**

In `_run_backtest_core`, read `max_position_count` and pass it when opening:

```python
# After reading risk_mgmt (already added in Task 1):
max_positions = risk_mgmt.get("max_position_count", 1)

# In the entry block, update the _open_position call:
position = _open_position(
    rule, capital, current_price, current_date, i, slippage, commission,
    df=df, bar_idx=i, max_positions=max_positions,   # NEW kwarg
)
```

- [ ] **Step 5: Pass `max_positions` from `_run_backtest_multi_core` caller**

In `_run_backtest_multi_core`, update the `_open_position` call (already reads `max_positions`):

```python
# Find the existing _open_position call in _run_backtest_multi_core and add max_positions:
position = _open_position(
    rule, alloc_capital, current_price,
    current_date_str, bar_idx, slippage, commission,
    df=df, bar_idx=bar_idx, max_positions=max_positions,   # NEW kwarg
)
```

- [ ] **Step 6: Run test to confirm it passes**

```bash
python -m pytest tests/test_backtest_engine.py::test_equal_weight_position_sizing -v
```

Expected: PASS

- [ ] **Step 7: Run full test suite**

```bash
python -m pytest tests/ -v --tb=short -q
```

Expected: all 86 tests pass (now 87 with new test).

- [ ] **Step 8: Commit**

```bash
git add apps/engine/services/backtester.py apps/engine/tests/test_backtest_engine.py
git commit -m "feat: implement equal_weight position sizing"
```

---

## Task 3: Skip expensive metrics and return clear warning on 0 trades

**Files:**
- Modify: `apps/engine/main.py` — `_compute_backtest_metrics` function (lines 117–371)
- Test: `apps/engine/tests/test_api_endpoints.py`

When a backtest produces 0 trades, the current code still runs walk-forward validation and fetches benchmark data for alpha/beta — both are network calls that take several seconds and produce meaningless results. We add an early-return path that skips these and returns a clear warning in the result.

- [ ] **Step 1: Write the failing test**

Add to `apps/engine/tests/test_api_endpoints.py` (or a new function at the bottom):

```python
def test_zero_trade_result_has_warning():
    """
    When backtest produces 0 trades, result must include a zero_trades_warning
    and must NOT include walk_forward results (expensive + meaningless).
    """
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    import pandas as pd
    import numpy as np

    # Build a minimal result dict that simulates what _compute_backtest_metrics receives
    # We call it indirectly via the bt_result dict
    from main import _compute_backtest_metrics

    np.random.seed(42)
    n = 100
    dates = pd.date_range("2022-01-01", periods=n, freq="B")
    close = 100.0 * np.exp(np.cumsum(np.random.normal(0.0005, 0.01, n)))
    df = pd.DataFrame({
        "Open": close, "High": close * 1.005, "Low": close * 0.995,
        "Close": close, "Volume": 1_000_000.0,
    }, index=dates)

    equity_curve = [[str(d), 100_000.0] for d in dates]
    bt_result = {"trades": [], "equity_curve": equity_curve, "capital": 100_000.0}

    strategy = {
        "universe": {"market": "US"},
        "timeframe": "1d",
        "backtest_config": {"initial_capital": 100_000, "currency": "USD"},
        "indicators": [],
    }

    result = _compute_backtest_metrics(
        bt_result=bt_result, df=df, strategy=strategy,
        initial_capital=100_000, equity_curve_data=equity_curve,
        indicators=[],
    )

    assert "zero_trades_warning" in result, "Expected zero_trades_warning key in result"
    assert result["walk_forward"] is None, "Expected walk_forward to be None for 0-trade result"
    assert result["summary"]["total_trades"] == 0
```

- [ ] **Step 2: Run to confirm it fails**

```bash
python -m pytest tests/test_api_endpoints.py::test_zero_trade_result_has_warning -v
```

Expected: FAIL — `zero_trades_warning` key not in result.

- [ ] **Step 3: Add early-return path to `_compute_backtest_metrics` in `main.py`**

In `apps/engine/main.py`, in `_compute_backtest_metrics`, add after the initial variable extraction (after the `trades = bt_result["trades"]` line, before any computation):

```python
    trades = bt_result["trades"]
    equity_curve = bt_result["equity_curve"]
    capital = bt_result["capital"]
    universe = strategy.get("universe", {})

    # --- Early return for zero-trade results ---
    if not trades:
        total_return = ((capital - initial_capital) / initial_capital) * 100
        summary = {
            "total_return_percent": 0.0,
            "annualized_return_percent": 0.0,
            "sharpe_ratio": 0.0,
            "sortino_ratio": 0.0,
            "max_drawdown_percent": 0.0,
            "max_drawdown_duration_days": 0,
            "total_trades": 0,
            "winning_trades": 0,
            "losing_trades": 0,
            "win_rate": 0.0,
            "profit_factor": 0.0,
            "avg_win_percent": 0.0,
            "avg_loss_percent": 0.0,
            "avg_holding_bars": 0.0,
            "best_trade_percent": 0.0,
            "worst_trade_percent": 0.0,
            "calmar_ratio": 0.0,
            "volatility_annual": 0.0,
            "benchmark_return_percent": round(
                ((float(df.iloc[-1]["Close"]) / float(df.iloc[0]["Close"])) - 1) * 100, 2
            ),
            "alpha": 0.0,
            "beta": 0.0,
        }
        score = ScoreCalculator.compute(summary)
        return {
            "strategy_id": strategy.get("id", "temp"),
            "run_id": f"bt_{int(time.time())}",
            "run_timestamp": pd.Timestamp.now().isoformat(),
            "summary": summary,
            "score": score,
            "equity_curve": equity_curve,
            "drawdown_curve": [],
            "trades": [],
            "monthly_returns": [],
            "regime_performance": [],
            "walk_forward": None,
            "zero_trades_warning": (
                "No trades fired — entry conditions never triggered on the available data. "
                "Try relaxing entry thresholds, extending the backtest period, or switching to a daily timeframe."
            ),
        }
    # --- End early return ---
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
python -m pytest tests/test_api_endpoints.py::test_zero_trade_result_has_warning -v
```

Expected: PASS

- [ ] **Step 5: Run full test suite**

```bash
python -m pytest tests/ -v --tb=short -q
```

Expected: all 87 tests pass (now 88 with new test).

- [ ] **Step 6: Commit**

```bash
git add apps/engine/main.py apps/engine/tests/test_api_endpoints.py
git commit -m "fix: skip expensive metrics + add clear warning for 0-trade backtests"
```

---

## Self-Review

**Spec coverage:**
- Single-ticker drawdown halt → Task 1 ✅
- `equal_weight` position sizing → Task 2 ✅
- 0-trade handling → Task 3 ✅

**Placeholder scan:** No TBDs, no vague steps — all code blocks are complete.

**Type consistency:**
- `max_positions` parameter added to `_open_position` in Task 2 with default `= 1`, so existing callers in Task 1 that don't pass it yet still work. Task 2 Step 4 and 5 then add the kwarg to both callers. No breakage.
- `_compute_backtest_metrics` signature unchanged — early return added inside the function body.
- `zero_trades_warning` key name used consistently in Task 3 Step 1 (test) and Step 3 (implementation).
