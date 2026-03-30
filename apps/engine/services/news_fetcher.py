"""
Financial news headline fetching for AI prompt context.

Fetches from NewsAPI, GNews, then Google News RSS, caching results in memory
for 6 hours to avoid repeated network calls.
"""

from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET


class NewsFetcher:
    """Fetch financial headlines from multiple providers with graceful fallback."""

    CACHE_TTL = 6 * 60 * 60
    GOOGLE_RSS_URLS = {
        "US": "https://news.google.com/rss/search?q=US+stock+market+S%26P500+finance&hl=en-US&gl=US&ceid=US:en",
        "IN": "https://news.google.com/rss/search?q=India+stock+market+NSE+Nifty+Sensex&hl=en-IN&gl=IN&ceid=IN:en",
    }
    _cache: dict[tuple[str, int], dict] = {}

    def __init__(self):
        self.last_source = ""

    def fetch_headlines(self, market: str = "US", limit: int = 10) -> list[dict]:
        """
        Fetch financial news headlines for the given market.

        Returns a list of {"title": str, "source": str, "published": str}.
        Never raises; returns an empty list if all sources fail.
        """
        normalized_market = str(market or "US").upper()
        normalized_limit = max(1, int(limit))
        cache_key = (normalized_market, normalized_limit)
        cached = self._cache.get(cache_key)

        if cached and (time.time() - cached["timestamp"] < self.CACHE_TTL):
            self.last_source = cached["source"]
            return list(cached["headlines"])

        for fetcher in (
            self._fetch_newsapi,
            self._fetch_gnews,
            self._fetch_google_rss,
        ):
            try:
                source_name, headlines = fetcher(normalized_market, normalized_limit)
                if headlines:
                    self.last_source = source_name
                    self._cache[cache_key] = {
                        "timestamp": time.time(),
                        "source": source_name,
                        "headlines": headlines,
                    }
                    return list(headlines)
            except Exception:
                continue

        self.last_source = ""
        return []

    def _fetch_newsapi(self, market: str, limit: int) -> tuple[str, list[dict]]:
        api_key = os.getenv("NEWS_API_KEY")
        if not api_key:
            return "newsapi", []

        params = urllib.parse.urlencode(
            {
                "category": "business",
                "country": "in" if market == "IN" else "us",
                "pageSize": limit,
                "apiKey": api_key,
            }
        )
        request = urllib.request.Request(
            f"https://newsapi.org/v2/top-headlines?{params}",
            headers={"User-Agent": "StrategyForge/1.0"},
        )
        payload = self._load_json(request)
        articles = payload.get("articles", [])

        return "newsapi", [
            {
                "title": article.get("title", "").strip(),
                "source": (article.get("source") or {}).get("name", "NewsAPI"),
                "published": article.get("publishedAt", ""),
            }
            for article in articles
            if article.get("title")
        ][:limit]

    def _fetch_gnews(self, _market: str, limit: int) -> tuple[str, list[dict]]:
        api_key = os.getenv("GNEWS_API_KEY")
        if not api_key:
            return "gnews", []

        params = urllib.parse.urlencode(
            {
                "category": "business",
                "lang": "en",
                "max": limit,
                "apikey": api_key,
            }
        )
        request = urllib.request.Request(
            f"https://gnews.io/api/v4/top-headlines?{params}",
            headers={"User-Agent": "StrategyForge/1.0"},
        )
        payload = self._load_json(request)
        articles = payload.get("articles", [])

        return "gnews", [
            {
                "title": article.get("title", "").strip(),
                "source": (article.get("source") or {}).get("name", "GNews"),
                "published": article.get("publishedAt", ""),
            }
            for article in articles
            if article.get("title")
        ][:limit]

    def _fetch_google_rss(self, market: str, limit: int) -> tuple[str, list[dict]]:
        url = self.GOOGLE_RSS_URLS.get(market, self.GOOGLE_RSS_URLS["US"])
        request = urllib.request.Request(
            url,
            headers={"User-Agent": "StrategyForge/1.0"},
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            xml_bytes = response.read()

        root = ET.fromstring(xml_bytes)
        headlines = []
        for item in root.findall(".//item"):
            title = (item.findtext("title") or "").strip()
            published = (item.findtext("pubDate") or "").strip()
            source = (item.findtext("source") or "Google News RSS").strip()
            if title:
                headlines.append(
                    {
                        "title": title,
                        "source": source or "Google News RSS",
                        "published": published,
                    }
                )
            if len(headlines) >= limit:
                break

        return "google_rss", headlines

    @staticmethod
    def _load_json(request: urllib.request.Request) -> dict:
        with urllib.request.urlopen(request, timeout=10) as response:
            body = response.read().decode("utf-8")
        return json.loads(body)
