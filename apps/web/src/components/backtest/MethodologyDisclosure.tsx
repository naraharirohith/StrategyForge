"use client";
import { useState } from "react";

interface Props {
  dataSource?: string;
  commissionPct?: number;
  slippagePct?: number;
  currency?: string;
}

export function MethodologyDisclosure({ dataSource = "Yahoo Finance", commissionPct = 0.1, slippagePct = 0.05, currency = "USD" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111118]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-medium text-gray-300">Backtest Methodology & Assumptions</span>
        <svg
          className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-white/[0.06] px-5 py-4 text-xs text-gray-400 space-y-3">
          <div>
            <p className="font-semibold text-gray-300 mb-1">Data Source</p>
            <p>{dataSource} (adjusted OHLCV). Free data may have gaps or inaccuracies compared to premium feeds. No survivorship bias adjustment applied.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-300 mb-1">Execution Model</p>
            <p>Trades execute at the close of the signal bar with {slippagePct}% slippage and {commissionPct}% commission per trade.
            {currency === "INR" ? " Indian commission includes approximate STT/charges." : ""}
            No partial fills — assumes full fill at modeled price. No margin or leverage.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-300 mb-1">Limitations</p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>Single-ticker backtesting only — portfolio-level correlation effects not modeled</li>
              <li>No look-ahead bias, but conditions are evaluated on close prices (not intrabar)</li>
              <li>Market impact not modeled — large positions in illiquid stocks would face worse execution</li>
              <li>Dividends and corporate actions not explicitly handled beyond yfinance adjustments</li>
              <li>Past performance does not predict future results</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-gray-300 mb-1">Scoring</p>
            <p>Strategy Score (0-100) is a weighted composite of Sharpe ratio (25%), max drawdown (20%), profit factor (15%), consistency (15%), regime score (15%), and win rate (10%). Confidence Score is a live assessment combining backtest strength (40%), market regime fit (30%), signal proximity (20%), and volatility context (10%).</p>
          </div>
        </div>
      )}
    </div>
  );
}
