"use client";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { fmtDate } from "@/lib/utils";

interface Props {
  drawdownCurve: [string, number][];
}

export function DrawdownChart({ drawdownCurve }: Props) {
  const data = drawdownCurve
    .filter((_, i) => i % Math.max(1, Math.floor(drawdownCurve.length / 300)) === 0)
    .map(([date, value]) => ({ date: date.split(" ")[0], value }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-700">Drawdown</h3>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: any) => String(v).slice(0, 7)}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: any) => `${Number(v).toFixed(0)}%`}
            width={45}
          />
          <Tooltip
            formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "Drawdown"]}
            labelFormatter={(l: any) => fmtDate(l)}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#dc2626"
            fill="#fef2f2"
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
