"use client";

interface Props {
  monthlyReturns: { month: string; return_percent: number }[];
}

const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function getCellColor(value: number): string {
  // Interpolate between anchor points for smooth gradients
  if (value <= -10) return "#dc2626";
  if (value <= -3) {
    const t = (value + 10) / 7; // 0 at -10, 1 at -3
    return lerpColor("#dc2626", "#fca5a5", t);
  }
  if (value < 0) {
    const t = (value + 3) / 3; // 0 at -3, 1 at 0
    return lerpColor("#fca5a5", "#fef2f2", t);
  }
  if (value === 0) return "#f9fafb";
  if (value <= 3) {
    const t = value / 3; // 0 at 0, 1 at 3
    return lerpColor("#f0fdf4", "#86efac", t);
  }
  if (value <= 10) {
    const t = (value - 3) / 7; // 0 at 3, 1 at 10
    return lerpColor("#86efac", "#16a34a", t);
  }
  return "#16a34a";
}

function getTextColor(value: number): string {
  // White text on deep colors, dark text on pale colors
  if (value <= -10 || value >= 10) return "#ffffff";
  if (value <= -6 || value >= 6) return "#ffffff";
  return "#1e293b";
}

function lerpColor(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

function formatReturn(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function MonthlyReturns({ monthlyReturns }: Props) {
  if (!monthlyReturns || monthlyReturns.length === 0) return null;

  // Group by year
  const byYear: Record<number, Record<number, number>> = {};
  for (const entry of monthlyReturns) {
    const [yearStr, monthStr] = entry.month.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-indexed
    if (!byYear[year]) byYear[year] = {};
    byYear[year][month] = entry.return_percent;
  }

  const years = Object.keys(byYear).map(Number).sort();

  // Compute yearly totals
  const yearlyTotals: Record<number, number> = {};
  for (const year of years) {
    yearlyTotals[year] = Object.values(byYear[year]).reduce((s, v) => s + v, 0);
  }

  // Compute monthly averages across all years
  const monthlyAverages: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    const values = years.map((y) => byYear[y][m]).filter((v) => v !== undefined);
    monthlyAverages[m] = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
  }
  const avgTotal = Object.values(monthlyAverages).reduce((s, v) => s + v, 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Monthly Returns</h3>
        <p className="text-xs text-slate-400">Returns by calendar month</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-slate-500 w-14">Year</th>
              {MONTH_LABELS.map((label, i) => (
                <th key={i} className="px-1 py-1.5 text-center text-xs font-medium text-slate-500 w-14">
                  {label}
                </th>
              ))}
              <th className="px-1 py-1.5 text-center text-xs font-semibold text-slate-700 w-16">Year</th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr key={year}>
                <td className="px-2 py-1 text-xs font-medium text-slate-600">{year}</td>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                  const value = byYear[year][month];
                  const hasData = value !== undefined;
                  return (
                    <td key={month} className="px-0.5 py-0.5">
                      <div
                        className="flex items-center justify-center rounded px-1 py-1.5"
                        style={
                          hasData
                            ? { backgroundColor: getCellColor(value), color: getTextColor(value) }
                            : { backgroundColor: "#f1f5f9", color: "#94a3b8" }
                        }
                      >
                        <span className="font-mono text-xs leading-none">
                          {hasData ? formatReturn(value) : "\u2014"}
                        </span>
                      </div>
                    </td>
                  );
                })}
                <td className="px-0.5 py-0.5">
                  <div
                    className="flex items-center justify-center rounded px-1 py-1.5 font-semibold"
                    style={{
                      backgroundColor: getCellColor(yearlyTotals[year]),
                      color: getTextColor(yearlyTotals[year]),
                    }}
                  >
                    <span className="font-mono text-xs leading-none">
                      {formatReturn(yearlyTotals[year])}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {/* Average row */}
            <tr className="border-t border-slate-200">
              <td className="px-2 py-1 text-xs font-medium text-slate-500 italic">Avg</td>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                const value = monthlyAverages[month];
                const hasValues = years.some((y) => byYear[y][month] !== undefined);
                return (
                  <td key={month} className="px-0.5 py-0.5">
                    <div
                      className="flex items-center justify-center rounded px-1 py-1.5"
                      style={
                        hasValues
                          ? { backgroundColor: getCellColor(value), color: getTextColor(value) }
                          : { backgroundColor: "#f1f5f9", color: "#94a3b8" }
                      }
                    >
                      <span className="font-mono text-xs leading-none">
                        {hasValues ? formatReturn(value) : "\u2014"}
                      </span>
                    </div>
                  </td>
                );
              })}
              <td className="px-0.5 py-0.5">
                <div
                  className="flex items-center justify-center rounded px-1 py-1.5 font-semibold"
                  style={{
                    backgroundColor: getCellColor(avgTotal),
                    color: getTextColor(avgTotal),
                  }}
                >
                  <span className="font-mono text-xs leading-none">
                    {formatReturn(avgTotal)}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
