export type Market = "US" | "IN";

export interface SectorTile {
  label: string;
  value: string;
  icon: string;
}

export interface MarketConfig {
  flag: string;
  label: string;
  currency: string;
  currencySymbol: string;
  locale: string;
  benchmarkLabel: string;
  benchmarkTicker: string;
  commissionPct: number;
  slippagePct: number;
  capitalExample: string;
  brokerContext: string;
  vixLabel: string;
  globalRiskTickers: string[];
  sectors: SectorTile[];
  promptHint: string;
}

export const MARKET_CONFIG: Record<Market, MarketConfig> = {
  US: {
    flag: "🇺🇸",
    label: "US",
    currency: "USD",
    currencySymbol: "$",
    locale: "en-US",
    benchmarkLabel: "S&P 500",
    benchmarkTicker: "SPY",
    commissionPct: 0.1,
    slippagePct: 0.05,
    capitalExample: "$25,000",
    brokerContext: "Schwab / IBKR / TD Ameritrade compatible",
    vixLabel: "VIX",
    globalRiskTickers: ["^GSPC", "CL=F"],
    sectors: [
      { label: "Technology", value: "technology", icon: "💻" },
      { label: "Healthcare", value: "healthcare", icon: "🏥" },
      { label: "Financials", value: "financials", icon: "🏦" },
      { label: "Energy", value: "energy", icon: "⚡" },
      { label: "Consumer", value: "consumer", icon: "🛍️" },
      { label: "Industrials", value: "industrials", icon: "🏭" },
    ],
    promptHint: "e.g. I want to invest in tech stocks with good momentum",
  },
  IN: {
    flag: "🇮🇳",
    label: "India",
    currency: "INR",
    currencySymbol: "₹",
    locale: "en-IN",
    benchmarkLabel: "Nifty 50",
    benchmarkTicker: "^NSEI",
    commissionPct: 0.03,
    slippagePct: 0.1,
    capitalExample: "₹2,00,000",
    brokerContext: "Zerodha / Groww / Upstox compatible",
    vixLabel: "India VIX",
    globalRiskTickers: ["^NSEI", "CL=F", "INR=X"],
    sectors: [
      { label: "IT", value: "it", icon: "💻" },
      { label: "Banking", value: "banking", icon: "🏦" },
      { label: "Pharma", value: "pharma", icon: "💊" },
      { label: "Energy", value: "energy", icon: "⚡" },
      { label: "Auto", value: "auto", icon: "🚗" },
      { label: "FMCG", value: "fmcg", icon: "🛒" },
    ],
    promptHint: "e.g. I want to invest in Nifty IT stocks with strong momentum",
  },
};
