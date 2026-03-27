"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtDate } from "@/lib/utils";

interface Props {
  drawdownCurve: [string, number][];
}

export function DrawdownChart({ drawdownCurve }: Props) {
  const data = drawdownCurve
    .filter((_, index) => index % Math.max(1, Math.floor(drawdownCurve.length / 300)) === 0)
    .map(([date, value]) => ({ date: date.split(" ")[0], value }));

  return (
    <section className="glass-panel p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Risk Path</p>
          <h3 className="mt-2 text-2xl font-semibold text-[color:var(--ink-strong)]">Drawdown curve</h3>
        </div>
        <p className="text-sm text-[color:var(--ink-muted)]">Peak-to-trough pain over time</p>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#908878" }}
            tickFormatter={(value: string | number) => String(value).slice(0, 7)}
            interval="preserveStartEnd"
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#908878" }}
            tickFormatter={(value: number) => `${Number(value).toFixed(0)}%`}
            width={48}
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
            formatter={(value) => {
              const numeric = Array.isArray(value) ? Number(value[0] ?? 0) : Number(value ?? 0);
              return [`${numeric.toFixed(2)}%`, "Drawdown"];
            }}
            labelFormatter={(label) => fmtDate(String(label ?? ""))}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#d1794a"
            fill="rgba(209,121,74,0.24)"
            strokeWidth={1.8}
          />
        </AreaChart>
      </ResponsiveContainer>
    </section>
  );
}
