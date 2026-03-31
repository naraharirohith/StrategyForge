"""
Condition evaluation functions for StrategyForge backtesting engine.

Evaluates entry/exit conditions against DataFrame bars, supporting nested
AND/OR logic, comparison operators, cross-detection, and proximity estimation.

Bug fixes applied:
- Added 'between' operator support in evaluate_single_condition.
"""


def evaluate_conditions(cond_group: dict, df, bar_idx: int, indicators: list) -> bool:
    """
    Evaluate a ConditionGroup against the current bar.
    Supports nested AND/OR logic.

    Args:
        cond_group: Condition group dict with 'logic' and 'conditions' keys.
        df: DataFrame with OHLCV and indicator columns.
        bar_idx: Current bar index.
        indicators: List of indicator config dicts.

    Returns:
        True if the condition group is satisfied at bar_idx.
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
    """
    Evaluate a single condition at the current bar.

    Args:
        cond: Condition dict with 'left', 'right', 'operator' keys.
        df: DataFrame with OHLCV and indicator columns.
        bar_idx: Current bar index.

    Returns:
        True if the condition is satisfied.
    """
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
        elif op == "between":
            # Bug fix: 'between' operator was not implemented.
            # right2 provides the second bound; falls back to right if missing.
            right_val2 = resolve_value(cond.get("right2", cond.get("right", {})), df, bar_idx)
            if right_val2 is not None:
                return min(right_val, right_val2) <= left_val <= max(right_val, right_val2)
            return False
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
    """
    Resolve a ConditionValueSource to a float value.

    Args:
        source: Value source dict with 'type' and type-specific keys.
        df: DataFrame with OHLCV and indicator columns.
        bar_idx: Current bar index.

    Returns:
        Float value, or None if unresolvable.
    """
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


def collect_condition_stats(entry_rules: list, df, indicators: list) -> dict:
    """
    Collect per-condition hit-rate statistics across all bars in df.

    Iterates over every bar (bar_idx=1 to len(df)-1) and evaluates each
    top-level condition in each entry rule individually, counting how often
    it was True. Returns a diagnostic dict useful for debugging zero-trade
    or low-trade backtests.

    Args:
        entry_rules: List of entry rule dicts from the strategy definition.
        df: DataFrame with OHLCV and indicator columns (post warmup).
        indicators: List of indicator config dicts (not used directly, kept
                    for signature consistency with other evaluator functions).

    Returns:
        Dict shaped as:
        {
          "rule_id": {
            "condition_id": {
              "description": "rsi_14 lt 40",
              "true_bars": 45,
              "total_bars": 1250,
              "hit_rate_pct": 3.6
            },
            ...
          },
          ...
        }
        Returns {} on any error.
    """
    try:
        if df is None or len(df) == 0 or not entry_rules:
            return {}

        total_bars = len(df) - 1  # bars from index 1 onward
        if total_bars <= 0:
            return {}

        result: dict = {}

        for rule in entry_rules:
            rule_id = rule.get("id", "unknown_rule")
            cond_group = rule.get("conditions", {})
            conditions = cond_group.get("conditions", [])
            if not conditions:
                continue

            rule_stats: dict = {}
            for cond in conditions:
                cond_id = cond.get("id", "unknown_cond")

                # Nested group — skip evaluation, mark as nested
                if "logic" in cond:
                    rule_stats[cond_id] = {
                        "description": "nested_group",
                        "true_bars": None,
                        "total_bars": total_bars,
                        "hit_rate_pct": None,
                    }
                    continue

                # Build human-readable description
                left = cond.get("left", {})
                right = cond.get("right", {})
                op = cond.get("operator", "?")

                left_str = (
                    left.get("indicator_id")
                    or left.get("field", "price")
                    if left.get("type") in ("indicator", "indicator_prev", "price")
                    else str(left.get("value", "?"))
                )
                right_str = (
                    right.get("indicator_id")
                    or right.get("field", "price")
                    if right.get("type") in ("indicator", "indicator_prev", "price")
                    else str(right.get("value", "?"))
                )
                description = f"{left_str} {op} {right_str}"

                # Count bars where condition is True
                true_count = 0
                for bar_idx in range(1, len(df)):
                    try:
                        if evaluate_single_condition(cond, df, bar_idx):
                            true_count += 1
                    except Exception:
                        pass

                hit_rate = round(true_count / total_bars * 100, 2) if total_bars > 0 else 0.0
                rule_stats[cond_id] = {
                    "description": description,
                    "true_bars": true_count,
                    "total_bars": total_bars,
                    "hit_rate_pct": hit_rate,
                }

            result[rule_id] = rule_stats

        return result
    except Exception:
        return {}


def estimate_condition_proximity(cond_group: dict, df, bar_idx: int) -> list:
    """
    Estimate how close each condition in a group is to triggering (0-100 scale).
    Used to compute signal proximity score when no signal is active.

    Args:
        cond_group: Condition group dict with 'logic' and 'conditions' keys.
        df: DataFrame with OHLCV and indicator columns.
        bar_idx: Current bar index.

    Returns:
        List of proximity scores (0-100) for each evaluable condition.
    """
    if not cond_group:
        return []

    scores = []
    for cond in cond_group.get("conditions", []):
        if "logic" in cond:
            scores.extend(estimate_condition_proximity(cond, df, bar_idx))
            continue
        try:
            left = resolve_value(cond.get("left", {}), df, bar_idx)
            right = resolve_value(cond.get("right", {}), df, bar_idx)
            op = cond.get("operator", "gt")
            import math
            if left is None or right is None or math.isnan(left) or math.isnan(right):
                continue
            if op in ("gt", "gte", "crosses_above"):
                # want left > right: score = how close left is to right from below
                if left >= right:
                    scores.append(90.0)
                else:
                    ratio = left / right if right != 0 else 0.5
                    scores.append(max(0.0, min(85.0, ratio * 90.0)))
            elif op in ("lt", "lte", "crosses_below"):
                # want left < right: score = how close left is to right from above
                if left <= right:
                    scores.append(90.0)
                else:
                    ratio = right / left if left != 0 else 0.5
                    scores.append(max(0.0, min(85.0, ratio * 90.0)))
        except Exception:
            continue
    return scores
