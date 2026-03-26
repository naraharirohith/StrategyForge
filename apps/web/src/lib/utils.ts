export function fmt(n: number, decimals = 2) {
  return n?.toFixed(decimals) ?? "—";
}

export function fmtPct(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${fmt(n)}%`;
}

export function fmtCurrency(n: number, currency = "USD") {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function currencySymbol(currency: string) {
  return currency === "INR" ? "\u20B9" : "$";
}

export function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function gradeColor(grade: string) {
  const map: Record<string, string> = {
    S: "text-yellow-500 bg-yellow-50 border-yellow-200",
    A: "text-purple-600 bg-purple-50 border-purple-200",
    B: "text-blue-600 bg-blue-50 border-blue-200",
    C: "text-green-600 bg-green-50 border-green-200",
    D: "text-amber-600 bg-amber-50 border-amber-200",
    F: "text-red-600 bg-red-50 border-red-200",
  };
  return map[grade] ?? "text-slate-600 bg-slate-50 border-slate-200";
}

export function scoreColor(score: number) {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}
