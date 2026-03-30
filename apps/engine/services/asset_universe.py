"""
Asset universe mapping utilities.

Maps user-friendly asset categories to concrete tickers for each market.
"""

ASSET_UNIVERSE = {
    # Commodities
    "gold": {"US": ["GLD", "IAU"], "IN": ["GOLDBEES.NS"]},
    "silver": {"US": ["SLV"], "IN": ["SILVERBEES.NS"]},
    "crude_oil": {"US": ["USO"], "IN": ["CRUDEOIL.NS"]},

    # Sectors
    "banking": {"US": ["XLF", "KBE"], "IN": ["SBIN.NS", "HDFCBANK.NS", "ICICIBANK.NS", "KOTAKBANK.NS"]},
    "technology": {"US": ["XLK", "QQQ"], "IN": ["TCS.NS", "INFY.NS", "WIPRO.NS", "HCLTECH.NS"]},
    "pharma": {"US": ["XLV", "IBB"], "IN": ["SUNPHARMA.NS", "DRREDDY.NS", "CIPLA.NS"]},
    "energy": {"US": ["XLE"], "IN": ["RELIANCE.NS", "ONGC.NS", "NTPC.NS"]},
    "auto": {"US": ["CARZ"], "IN": ["TATAMOTORS.NS", "M&M.NS", "MARUTI.NS"]},
    "realty": {"US": ["XLRE", "VNQ"], "IN": ["DLF.NS", "GODREJPROP.NS"]},
    "fmcg": {"US": ["XLP"], "IN": ["HINDUNILVR.NS", "ITC.NS", "NESTLEIND.NS"]},

    # Market cap
    "mid_cap": {"US": ["MDY", "IJH"], "IN": ["JUNIORBEES.NS"]},
    "small_cap": {"US": ["IWM", "IJR"], "IN": ["SMALLCAP50.NS"]},

    # Themes
    "ai_stocks": {"US": ["NVDA", "MSFT", "GOOGL", "META", "AMD"]},
    "ev_stocks": {"US": ["TSLA", "RIVN", "NIO"], "IN": ["TATAMOTORS.NS", "M&M.NS"]},
    "dividend": {"US": ["VYM", "SCHD", "DVY"], "IN": ["ITC.NS", "COALINDIA.NS", "POWERGRID.NS"]},
    "defense": {"US": ["LMT", "RTX", "NOC"], "IN": ["HAL.NS", "BEL.NS", "BHARATFORGE.NS"]},

    # Indices / Benchmarks
    "nifty": {"IN": ["^NSEI"]},
    "sensex": {"IN": ["^BSESN"]},
    "sp500": {"US": ["^GSPC"]},
    "nasdaq": {"US": ["^IXIC"]},

    # Crypto — all entries use market key "CRYPTO"
    "btc": {"CRYPTO": ["BTC-USD"]},
    "bitcoin": {"CRYPTO": ["BTC-USD"]},
    "eth": {"CRYPTO": ["ETH-USD"]},
    "ethereum": {"CRYPTO": ["ETH-USD"]},
    "defi": {"CRYPTO": ["UNI-USD", "AAVE-USD", "MKR-USD", "CRV-USD", "COMP-USD"]},
    "layer1": {"CRYPTO": ["BTC-USD", "ETH-USD", "SOL-USD", "AVAX-USD", "ADA-USD"]},
    "l1": {"CRYPTO": ["BTC-USD", "ETH-USD", "SOL-USD", "AVAX-USD", "ADA-USD"]},
    "layer2": {"CRYPTO": ["MATIC-USD", "ARB-USD", "OP-USD"]},
    "l2": {"CRYPTO": ["MATIC-USD", "ARB-USD", "OP-USD"]},
    "gaming": {"CRYPTO": ["AXS-USD", "SAND-USD", "MANA-USD", "GALA-USD"]},
    "large_cap": {
        "US": ["SPY", "QQQ", "DIA"],
        "IN": ["NIFTYBEES.NS"],
        "CRYPTO": ["BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD", "ADA-USD"],
    },
}


def resolve_tickers(category: str, market: str) -> list[str]:
    """Resolve a category/market pair into a concrete ticker list."""
    normalized_category = str(category or "").strip().lower()
    normalized_market = str(market or "").strip().upper()
    return list(ASSET_UNIVERSE.get(normalized_category, {}).get(normalized_market, []))
