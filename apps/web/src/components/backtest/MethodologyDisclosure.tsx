"use client";

import { useState } from "react";

interface Props {
  dataSource?: string;
  commissionPct?: number;
  slippagePct?: number;
  currency?: string;
}

function DisclosureBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">{title}</p>
      <p className="mt-3 text-sm leading-6 text-[color:var(--ink-muted)]">{body}</p>
    </div>
  );
}

export function MethodologyDisclosure({
  dataSource = "Yahoo Finance",
  commissionPct = 0.1,
  slippagePct = 0.05,
  currency = "USD",
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="glass-panel overflow-hidden">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <div>
          <p className="eyebrow">Methodology</p>
          <h3 className="mt-2 text-xl font-semibold text-[color:var(--ink-strong)]">
            Assumptions behind the simulation
          </h3>
        </div>
        <span className="rounded-full border border-white/[0.12] bg-white/[0.06] px-3 py-1 text-xs uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">
          {open ? "Hide" : "Open"}
        </span>
      </button>

      {open && (
        <div className="grid gap-4 border-t border-white/[0.08] px-6 py-6 md:grid-cols-2">
          <DisclosureBlock
            title="Data Source"
            body={`${dataSource} adjusted OHLCV bars are used. Free market data can contain gaps and does not include survivorship-bias adjustments.`}
          />
          <DisclosureBlock
            title="Execution Model"
            body={`Trades are modeled at the close of the signal bar with ${slippagePct}% slippage and ${commissionPct}% commission per trade.${currency === "INR" ? " Indian commission assumptions include approximate taxes and charges." : ""} No leverage or partial fills are modeled.`}
          />
          <DisclosureBlock
            title="Known Limits"
            body="This engine evaluates close-based signals, does not model portfolio correlation effects in depth, and cannot estimate market impact for larger or illiquid positions."
          />
          <DisclosureBlock
            title="Scoring Logic"
            body="Strategy Score blends Sharpe ratio, drawdown, profit factor, consistency, regime alignment, and win rate. Confidence Score adds current regime fit, signal timing, and volatility context on top of the backtest."
          />
        </div>
      )}
    </section>
  );
}
