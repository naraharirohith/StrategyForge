"use client";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { fmtCurrency, fmtDate } from "@/lib/utils";

interface Props {
  equityCurve: [string, number][];
  initialCapital: number;
}

export function EquityCurve({ equityCurve, initialCapital }: Props) {
  const data = equityCurve
    .filter((_, i) => i % Math.max(1, Math.floor(equityCurve.length / 300)) === 0)
    .map(([date, value]) => ({
      date: date.split(" ")[0],
      value,
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
            tickFormatter={(v) => v.slice(0, 7)}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            width={55}
          />
          <Tooltip
            formatter={(v: number) => [fmtCurrency(v), "Portfolio"]}
            labelFormatter={(l) => fmtDate(l)}
          />
          <ReferenceLine y={initialCapital} stroke="#94a3b8" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
