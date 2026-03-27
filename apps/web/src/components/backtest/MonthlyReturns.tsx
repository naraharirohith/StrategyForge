"use client";

interface Props {
  monthlyReturns: { month: string; return_percent: number }[];
}

const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function getCellColor(value: number): string {
  if (value <= -10) return "#8a3838";
  if (value <= -3) {
    const t = (value + 10) / 7;
    return lerpColor("#8a3838", "#d1794a", t);
  }
  if (value < 0) {
    const t = (value + 3) / 3;
    return lerpColor("#d1794a", "#2b2a2f", t);
  }
  if (value === 0) return "#20252f";
  if (value <= 3) {
    const t = value / 3;
    return lerpColor("#1f3f42", "#4b9ea8", t);
  }
  if (value <= 10) {
    const t = (value - 3) / 7;
    return lerpColor("#4b9ea8", "#88d1bc", t);
  }
  return "#88d1bc";
}

function getTextColor(value: number): string {
  if (value <= -6 || value >= 6) return "#fbf7ef";
  return "#e6dece";
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

  const byYear: Record<number, Record<number, number>> = {};
  for (const entry of monthlyReturns) {
    const [yearStr, monthStr] = entry.month.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    if (!byYear[year]) byYear[year] = {};
    byYear[year][month] = entry.return_percent;
  }

  const years = Object.keys(byYear).map(Number).sort();
  const yearlyTotals: Record<number, number> = {};
  for (const year of years) {
    yearlyTotals[year] = Object.values(byYear[year]).reduce((sum, value) => sum + value, 0);
  }

  const monthlyAverages: Record<number, number> = {};
  for (let month = 1; month <= 12; month++) {
    const values = years.map((year) => byYear[year][month]).filter((value) => value !== undefined);
    monthlyAverages[month] = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }
  const averageTotal = Object.values(monthlyAverages).reduce((sum, value) => sum + value, 0);

  return (
    <section className="glass-panel p-5 sm:p-6">
      <div className="mb-5">
        <p className="eyebrow">Seasonality</p>
        <h3 className="mt-2 text-2xl font-semibold text-[color:var(--ink-strong)]">Monthly returns matrix</h3>
        <p className="mt-2 text-sm text-[color:var(--ink-muted)]">Calendar month behavior by year, plus average seasonality.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full border-collapse">
          <thead>
            <tr>
              <th className="px-2 py-2 text-left text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">Year</th>
              {MONTH_LABELS.map((label, index) => (
                <th key={index} className="px-1 py-2 text-center text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                  {label}
                </th>
              ))}
              <th className="px-1 py-2 text-center text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">Year</th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr key={year}>
                <td className="px-2 py-1.5 text-sm font-medium text-[color:var(--ink-muted)]">{year}</td>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
                  const value = byYear[year][month];
                  const hasData = value !== undefined;
                  return (
                    <td key={month} className="px-1 py-1">
                      <div
                        className="flex items-center justify-center rounded-[14px] px-1 py-2"
                        style={
                          hasData
                            ? { backgroundColor: getCellColor(value), color: getTextColor(value) }
                            : { backgroundColor: "#1a1e25", color: "#6f6b63" }
                        }
                      >
                        <span className="mono text-xs">{hasData ? formatReturn(value) : "-"}</span>
                      </div>
                    </td>
                  );
                })}
                <td className="px-1 py-1">
                  <div
                    className="flex items-center justify-center rounded-[14px] px-1 py-2 font-semibold"
                    style={{
                      backgroundColor: getCellColor(yearlyTotals[year]),
                      color: getTextColor(yearlyTotals[year]),
                    }}
                  >
                    <span className="mono text-xs">{formatReturn(yearlyTotals[year])}</span>
                  </div>
                </td>
              </tr>
            ))}
            <tr className="border-t border-white/[0.08]">
              <td className="px-2 py-2 text-sm font-medium italic text-[color:var(--ink-soft)]">Avg</td>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
                const value = monthlyAverages[month];
                const hasValues = years.some((year) => byYear[year][month] !== undefined);
                return (
                  <td key={month} className="px-1 py-1">
                    <div
                      className="flex items-center justify-center rounded-[14px] px-1 py-2"
                      style={
                        hasValues
                          ? { backgroundColor: getCellColor(value), color: getTextColor(value) }
                          : { backgroundColor: "#1a1e25", color: "#6f6b63" }
                      }
                    >
                      <span className="mono text-xs">{hasValues ? formatReturn(value) : "-"}</span>
                    </div>
                  </td>
                );
              })}
              <td className="px-1 py-1">
                <div
                  className="flex items-center justify-center rounded-[14px] px-1 py-2 font-semibold"
                  style={{
                    backgroundColor: getCellColor(averageTotal),
                    color: getTextColor(averageTotal),
                  }}
                >
                  <span className="mono text-xs">{formatReturn(averageTotal)}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
