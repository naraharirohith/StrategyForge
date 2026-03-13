# StrategyForge Testing Guide

## Level 1: Service Health Checks

### Python Engine (port 8001)
```bash
curl http://localhost:8001/health
```
Expected response:
```json
{
  "status": "ok",
  "engine_version": "0.1.0",
  "supported_indicators": ["SMA", "EMA", ...]
}
```

### API Gateway (port 3001)
```bash
curl http://localhost:3001/api/health
```
Expected response:
```json
{
  "status": "ok",
  "api_version": "0.1.0",
  "engine": { "status": "ok", ... },
  "database": "connected"
}
```

### Frontend (port 3000)
Open http://localhost:3000 in browser - should see Next.js page.

## Level 2: Backtest Pipeline Test

Send the test strategy JSON to the Python engine:

```bash
curl -X POST http://localhost:8001/backtest \
  -H "Content-Type: application/json" \
  -d '{"strategy": {"schema_version":"1.0.0","name":"Test","description":"Test","style":"momentum","risk_level":"moderate","universe":{"market":"US","asset_class":"equity","tickers":["AAPL"]},"timeframe":"1d","indicators":[{"id":"ema_50","type":"EMA","params":{"period":50}},{"id":"ema_200","type":"EMA","params":{"period":200}},{"id":"rsi_14","type":"RSI","params":{"period":14}}],"entry_rules":[{"id":"e1","name":"Golden Cross","side":"long","conditions":{"logic":"AND","conditions":[{"id":"c1","left":{"type":"indicator","indicator_id":"ema_50"},"operator":"crosses_above","right":{"type":"indicator","indicator_id":"ema_200"}},{"id":"c2","left":{"type":"indicator","indicator_id":"rsi_14"},"operator":"lt","right":{"type":"constant","value":60}}]},"position_sizing":{"method":"percent_of_portfolio","percent":20}}],"exit_rules":[{"id":"x1","name":"Stop Loss","type":"stop_loss","value":5,"priority":1},{"id":"x2","name":"Take Profit","type":"take_profit","value":15,"priority":2}],"risk_management":{"max_portfolio_drawdown_percent":15,"max_position_count":5},"backtest_config":{"initial_capital":100000,"currency":"USD","commission_percent":0.1,"slippage_percent":0.05}}}'
```

Expected response:
```json
{
  "success": true,
  "result": {
    "summary": { "total_return_percent": ..., "sharpe_ratio": ... },
    "score": { "overall": ..., "grade": "..." },
    "trades": [...],
    "equity_curve": [...]
  },
  "duration_ms": ...
}
```

## Level 3: Full Pipeline Test (via API Gateway)

```bash
curl -X POST http://localhost:3001/api/strategies/backtest \
  -H "Content-Type: application/json" \
  -d '{"strategy": {"schema_version":"1.0.0","name":"Test","description":"Test","style":"momentum","risk_level":"moderate","universe":{"market":"US","asset_class":"equity","tickers":["AAPL"]},"timeframe":"1d","indicators":[{"id":"ema_50","type":"EMA","params":{"period":50}},{"id":"ema_200","type":"EMA","params":{"period":200}},{"id":"rsi_14","type":"RSI","params":{"period":14}}],"entry_rules":[{"id":"e1","name":"Golden Cross","side":"long","conditions":{"logic":"AND","conditions":[{"id":"c1","left":{"type":"indicator","indicator_id":"ema_50"},"operator":"crosses_above","right":{"type":"indicator","indicator_id":"ema_200"}},{"id":"c2","left":{"type":"indicator","indicator_id":"rsi_14"},"operator":"lt","right":{"type":"constant","value":60}}]},"position_sizing":{"method":"percent_of_portfolio","percent":20}}],"exit_rules":[{"id":"x1","name":"Stop Loss","type":"stop_loss","value":5,"priority":1},{"id":"x2","name":"Take Profit","type":"take_profit","value":15,"priority":2}],"risk_management":{"max_portfolio_drawdown_percent":15,"max_position_count":5},"backtest_config":{"initial_capital":100000,"currency":"USD","commission_percent":0.1,"slippage_percent":0.05}}}'
```

## Level 4: AI Strategy Generation (requires API key)

```bash
curl -X POST http://localhost:3001/api/strategies/generate \
  -H "Content-Type: application/json" \
  -d '{"description": "Create a simple momentum strategy for AAPL using RSI and EMA crossovers, moderate risk"}'
```

Expected: A full StrategyDefinition JSON response with AI-generated entry/exit rules.
