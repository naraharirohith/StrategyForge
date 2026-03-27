"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtCurrency, fmtDate, currencySymbol } from "@/lib/utils";

interface Props {
  equityCurve: [string, number][];
  initialCapital: number;
  currency?: string;
  benchmarkReturnPct?: number;
}

export function EquityCurve({ equityCurve, initialCapital, currency = "USD", benchmarkReturnPct }: Props) {
  const data = equityCurve
    .filter((_, index) => index % Math.max(1, Math.floor(equityCurve.length / 300)) === 0)
    .map(([date, value], index, array) => ({
      date: date.split(" ")[0],
      value,
      ...(benchmarkReturnPct != null
        ? {
            benchmark: initialCapital + (initialCapital * benchmarkReturnPct / 100) * (index / Math.max(1, array.length - 1)),
          }
        : {}),
    }));

  function axisFormatter(value: string | number) {
    return String(value).slice(0, 7);
  }

  function valueFormatter(value: number) {
    const symbol = currencySymbol(currency);
    if (currency === "INR" && value >= 100000) {
      return `${symbol}${(value / 100000).toFixed(1)}L`;
    }
    return `${symbol}${(value / 1000).toFixed(0)}k`;
  }

  return (
    <section className="glass-panel p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Performance Path</p>
          <h3 className="mt-2 text-2xl font-semibold text-[color:var(--ink-strong)]">Equity curve</h3>
        </div>
        <p className="text-sm text-[color:var(--ink-muted)]">Strategy vs baseline capital trajectory</p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#908878" }}
            tickFormatter={axisFormatter}
            interval="preserveStartEnd"
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#908878" }}
            tickFormatter={(value: number) => valueFormatter(Number(value))}
            width={60}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(16,20,27,0.96)",
              color: "#f7f2e8",
            }}
            formatter={(value, name) => {
              const numeric = Array.isArray(value) ? Number(value[0] ?? 0) : Number(value ?? 0);
              return [fmtCurrency(numeric, currency), name === "benchmark" ? "Buy & Hold" : "Strategy"];
            }}
            labelFormatter={(label) => fmtDate(String(label ?? ""))}
          />
          <ReferenceLine y={initialCapital} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="value" stroke="#eaae58" strokeWidth={2.5} dot={false} name="Strategy" />
          {benchmarkReturnPct != null && (
            <Line
              type="monotone"
              dataKey="benchmark"
              stroke="#78b7d0"
              strokeWidth={1.8}
              strokeDasharray="6 3"
              dot={false}
              name="Buy & Hold"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
