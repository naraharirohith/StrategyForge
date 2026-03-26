"""
Strategy score calculator for StrategyForge backtesting engine.

Computes a composite StrategyScore (0-100) from backtest metrics, breaking
down performance into Sharpe ratio, drawdown, win rate, profit factor,
consistency, and regime adaptability components.
"""


class ScoreCalculator:
    """Computes the composite StrategyScore (0-100)."""

    @staticmethod
    def compute(metrics: dict) -> dict:
        """
        Compute the composite score from backtest summary metrics.

        Args:
            metrics: Dict containing sharpe_ratio, max_drawdown_percent, win_rate,
                     profit_factor, monthly_returns, and regime_performance.

        Returns:
            Dict with overall score, breakdown, grade, and publishable/verified flags.
        """
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
