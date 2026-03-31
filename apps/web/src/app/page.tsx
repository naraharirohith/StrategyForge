"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MARKET_CONFIG, type Market } from "@/lib/marketConfig";

const MARKETS: Market[] = ["US", "IN"];
const STORAGE_KEY = "sf_market";

const EXCHANGE_LABELS: Record<Market, string> = {
  US: "NYSE · NASDAQ",
  IN: "NSE · BSE",
};

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Market | null;
    if (saved && (saved === "US" || saved === "IN")) {
      const timer = setTimeout(() => {
        router.push(`/${saved.toLowerCase()}`);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [router]);

  function handleSelect(market: Market) {
    localStorage.setItem(STORAGE_KEY, market);
    router.push(`/${market.toLowerCase()}`);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-gray-100 sm:text-4xl">
          Strategy<span className="text-blue-600">Forge</span>
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Choose your market to begin
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        {MARKETS.map((m) => {
          const cfg = MARKET_CONFIG[m];
          return (
            <button
              key={m}
              onClick={() => handleSelect(m)}
              className="flex-1 rounded-2xl border border-white/[0.06] bg-[#111118] p-6 text-center hover:border-blue-500/40 hover:bg-white/[0.03] transition-all"
            >
              <p className="text-4xl mb-3">{cfg.flag}</p>
              <p className="text-base font-semibold text-gray-100">{cfg.label} Stocks</p>
              <p className="text-xs text-gray-500 mt-1">{EXCHANGE_LABELS[m]}</p>
              <p className="text-[10px] text-gray-600 mt-2">{cfg.brokerContext}</p>
            </button>
          );
        })}
      </div>

      <p className="mt-10 text-[10px] text-gray-600">
        For educational purposes only. Not investment advice.
      </p>
    </div>
  );
}
