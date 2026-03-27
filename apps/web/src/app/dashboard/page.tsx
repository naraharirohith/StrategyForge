"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart3, Compass, Gauge, Trash2 } from "lucide-react";
import { getStrategies, deleteStrategy } from "@/lib/api";
import { fmtDate, gradeColor, fmt } from "@/lib/utils";
import { CardSkeleton } from "@/components/Skeleton";

type AnyObj = Record<string, unknown>;

const STYLE_COLORS: Record<string, string> = {
  momentum: "border-cyan-300/40 bg-cyan-500/10 text-cyan-100",
  mean_reversion: "border-fuchsia-300/40 bg-fuchsia-500/10 text-fuchsia-100",
  swing: "border-indigo-300/40 bg-indigo-500/10 text-indigo-100",
  positional: "border-teal-300/40 bg-teal-500/10 text-teal-100",
  intraday: "border-orange-300/40 bg-orange-500/10 text-orange-100",
  portfolio: "border-emerald-300/40 bg-emerald-500/10 text-emerald-100",
  hybrid: "border-white/10 bg-white/[0.06] text-[color:var(--ink-muted)]",
};

const RISK_COLORS: Record<string, string> = {
  conservative: "border-emerald-300/40 bg-emerald-500/10 text-emerald-100",
  moderate: "border-amber-300/40 bg-amber-500/10 text-amber-100",
  aggressive: "border-rose-300/40 bg-rose-500/10 text-rose-100",
};

function DashboardStat({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof BarChart3;
}) {
  return (
    <div className="soft-panel p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-[color:var(--ink-strong)]">{value}</p>
          <p className="mt-2 text-sm text-[color:var(--ink-muted)]">{detail}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.06] p-3 text-[color:var(--accent)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [strategies, setStrategies] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getStrategies();
        setStrategies(data.strategies ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load strategies");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this strategy? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await deleteStrategy(id);
      setStrategies((prev) => prev.filter((strategy) => (strategy.id as string) !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete strategy");
    } finally {
      setDeleting(null);
    }
  }

  const scoredStrategies = strategies.filter((strategy) => typeof strategy.score === "number");
  const averageScore =
    scoredStrategies.length > 0
      ? scoredStrategies.reduce((sum, strategy) => sum + (strategy.score as number), 0) / scoredStrategies.length
      : null;
  const profitableCount = strategies.filter(
    (strategy) => typeof strategy.totalReturn === "number" && (strategy.totalReturn as number) > 0,
  ).length;
  const markets = new Set(strategies.map((strategy) => String(strategy.market ?? "")).filter(Boolean));

  return (
    <div className="page-shell">
      <section className="grid gap-6 lg:grid-cols-[1.25fr,0.75fr]">
        <div className="glass-panel p-7 sm:p-8">
          <p className="eyebrow">Strategy Archive</p>
          <h1 className="display-title mt-3 max-w-3xl text-4xl sm:text-5xl">
            Your lab of saved systems, scores, and conviction calls.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[color:var(--ink-muted)]">
            Review what is working, retire weak ideas, and compare the strongest strategies before you spend more time iterating on them.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="nav-pill">
              Launch generator
            </Link>
            <Link href="/compare" className="stat-chip">
              Compare best ideas
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <DashboardStat
            label="Saved Systems"
            value={loading ? "..." : String(strategies.length)}
            detail="Total strategies preserved in your research archive."
            icon={Compass}
          />
          <DashboardStat
            label="Average Score"
            value={loading ? "..." : averageScore != null ? fmt(averageScore, 0) : "-"}
            detail="Across strategies that already completed scoring."
            icon={Gauge}
          />
          <DashboardStat
            label="Profitable Runs"
            value={loading ? "..." : String(profitableCount)}
            detail={`${markets.size || 0} markets represented in the current archive.`}
            icon={BarChart3}
          />
        </div>
      </section>

      {loading && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </section>
      )}

      {error && (
        <section className="rounded-[28px] border border-rose-300/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          {error}
        </section>
      )}

      {!loading && !error && strategies.length === 0 && (
        <section className="glass-panel px-6 py-16 text-center">
          <p className="eyebrow">Empty Lab</p>
          <h2 className="mt-3 text-3xl font-semibold text-[color:var(--ink-strong)]">No saved strategies yet.</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[color:var(--ink-muted)]">
            Start with a guided prompt or a quick template, then save the strongest ideas here once they have been generated and tested.
          </p>
          <Link href="/" className="nav-pill mt-8 inline-flex">
            Generate your first strategy
          </Link>
        </section>
      )}

      {!loading && strategies.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Saved Strategies</p>
              <h2 className="section-title">Every idea, ranked and ready to review</h2>
            </div>
            <p className="max-w-md text-right text-sm leading-6 text-[color:var(--ink-muted)]">
              Open a detail page for the full research stack or remove outdated systems to keep the archive sharp.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {strategies.map((strategy) => {
              const id = strategy.id as string;
              const style = (strategy.style as string) ?? "";
              const risk = (strategy.riskLevel as string) ?? "";
              const market = (strategy.market as string) ?? "";
              const score = strategy.score as number | null;
              const grade = strategy.grade as string | null;
              const totalReturn = strategy.totalReturn as number | null;

              return (
                <article key={id} className="glass-panel flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-xl font-semibold text-[color:var(--ink-strong)]">
                        {strategy.name as string}
                      </h3>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {market && (
                          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                            {market}
                          </span>
                        )}
                        {style && (
                          <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${STYLE_COLORS[style] ?? STYLE_COLORS.hybrid}`}>
                            {style.replace(/_/g, " ")}
                          </span>
                        )}
                        {risk && (
                          <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${RISK_COLORS[risk] ?? "border-white/10 bg-white/[0.06] text-[color:var(--ink-soft)]"}`}>
                            {risk} risk
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-right">
                      {score != null ? (
                        <>
                          <p className="mono text-3xl font-semibold text-[color:var(--ink-strong)]">{fmt(score, 0)}</p>
                          {grade && (
                            <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${gradeColor(grade)}`}>
                              Grade {grade}
                            </span>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-[color:var(--ink-soft)]">Not scored</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">Total Return</p>
                      <p className={`mono mt-2 text-2xl font-semibold ${totalReturn != null && totalReturn >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                        {totalReturn != null ? `${totalReturn >= 0 ? "+" : ""}${fmt(totalReturn, 2)}%` : "-"}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">Created</p>
                      <p className="mt-2 text-base font-medium text-[color:var(--ink-strong)]">
                        {fmtDate(strategy.createdAt as string)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-3">
                    <button
                      onClick={() => handleDelete(id)}
                      disabled={deleting === id}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-300/25 bg-rose-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-rose-100 transition hover:bg-rose-500/18 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deleting === id ? "Deleting" : "Delete"}
                    </button>
                    <Link href={`/strategy/${id}`} className="nav-pill">
                      View research
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <p className="pb-2 text-center text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">
        Educational use only. Not investment advice.
      </p>
    </div>
  );
}
