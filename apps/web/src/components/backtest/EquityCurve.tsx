"use client";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
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
    .filter((_, i) => i % Math.max(1, Math.floor(equityCurve.length / 300)) === 0)
    .map(([date, value], i, arr) => ({
      date: date.split(" ")[0],
      value,
      ...(benchmarkReturnPct != null ? {
        benchmark: initialCapital + (initialCapital * benchmarkReturnPct / 100) * (i / (arr.length - 1))
      } : {}),
    }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-700">Equity Curve</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: any) => String(v).slice(0, 7)}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: any) => {
              const sym = currencySymbol(currency);
              if (currency === "INR" && v >= 100000) {
                return `${sym}${(v / 100000).toFixed(1)}L`;
              }
              return `${sym}${(v / 1000).toFixed(0)}k`;
            }}
            width={55}
          />
          <Tooltip
            formatter={(v: any, name: any) => [
              fmtCurrency(Number(v), currency),
              name === "benchmark" ? "Buy & Hold" : "Strategy",
            ]}
            labelFormatter={(l: any) => fmtDate(l)}
          />
          <ReferenceLine y={initialCapital} stroke="#94a3b8" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            name="Strategy"
          />
          {benchmarkReturnPct != null && (
            <Line
              type="monotone"
              dataKey="benchmark"
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              name="Buy & Hold"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
