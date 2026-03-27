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
    <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-5">
      <h3 className="mb-4 text-sm font-semibold text-gray-300">Drawdown</h3>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickFormatter={(v: any) => String(v).slice(0, 7)}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickFormatter={(v: any) => `${Number(v).toFixed(0)}%`}
            width={45}
          />
          <Tooltip
            formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "Drawdown"]}
            labelFormatter={(l: any) => fmtDate(l)}
            contentStyle={{ backgroundColor: "#1a1a24", border: "1px solid #2a2a3a" }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#dc2626"
            fill="rgba(239,68,68,0.1)"
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
