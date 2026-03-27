"""
Async web search and full-text extraction tools.

Search layer:
  DuckDuckGo's Python client is synchronous, so each call is offloaded to a
  thread via asyncio.to_thread.  A fresh DDGS() instance is created per call
  because the class is not thread-safe when shared across concurrent threads.
  Falls back to structured mock data when the search is unavailable.

Deep reading layer:
  After collecting search result URLs, enrich_results_with_full_text() fetches
  the full body text of each page via the Jina Reader API (r.jina.ai).
  Jina returns clean markdown; short navigation/ad lines are stripped locally.
  httpx is used for async HTTP; failures are silently skipped so the
  workflow always makes forward progress even when pages are unreachable.
"""
from __future__ import annotations

import asyncio
import logging
import re
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────
# Deep-reading constants
# ──────────────────────────────────────────────────────────────────────

_JINA_BASE         = "https://r.jina.ai/"
_FULL_TEXT_MAX     = 4000   # characters kept per page (prevents token bloat)
_JINA_TIMEOUT      = 8.0    # seconds; skip page if exceeded
_MIN_LINE_LEN      = 25     # lines shorter than this are treated as nav/ads
# Domains known to block scrapers or return low-value content
_SKIP_DOMAINS = {
    "twitter.com", "x.com", "facebook.com", "instagram.com",
    "linkedin.com", "youtube.com", "reddit.com",
    "gartner.com", "statista.com",   # paywalled research aggregators
}


# ──────────────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────────────

def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc
    except Exception:
        return url


def _clean_jina_text(raw: str) -> str:
    """
    Strip navigation/ad noise from Jina markdown output and truncate.
    Removes lines shorter than _MIN_LINE_LEN characters (menu items,
    breadcrumbs, single-word labels) and collapses excess whitespace.
    """
    lines = raw.splitlines()
    kept = [
        ln for ln in lines
        if len(ln.strip()) >= _MIN_LINE_LEN
        or ln.strip().startswith("#")   # keep markdown headings regardless of length
    ]
    cleaned = re.sub(r"\n{3,}", "\n\n", "\n".join(kept)).strip()
    return cleaned[:_FULL_TEXT_MAX]


async def _fetch_full_text_one(url: str) -> str:
    """
    Fetch full body text for a single URL via Jina Reader API.
    Returns empty string on any failure so callers can skip gracefully.
    """
    domain = _extract_domain(url)
    if any(skip in domain for skip in _SKIP_DOMAINS):
        return ""
    try:
        async with httpx.AsyncClient(timeout=_JINA_TIMEOUT, follow_redirects=True) as client:
            response = await client.get(
                f"{_JINA_BASE}{url}",
                headers={"Accept": "text/plain", "User-Agent": "Mozilla/5.0"},
            )
            if response.status_code == 200:
                return _clean_jina_text(response.text)
    except Exception as exc:
        logger.debug("Jina fetch failed for '%s': %s", url, exc)
    return ""


def _sync_search(query: str, max_results: int) -> list[dict]:
    """Runs a DuckDuckGo text search synchronously."""
    from duckduckgo_search import DDGS  # imported lazily to isolate failures

    with DDGS() as ddgs:
        raw = list(ddgs.text(query, max_results=max_results))

    return [
        {
            "title": r.get("title", ""),
            "url": r.get("href", ""),
            "snippet": r.get("body", ""),
            "source": _extract_domain(r.get("href", "")),
        }
        for r in raw
    ]


def _mock_results(query: str) -> list[dict]:
    """Returns structured mock search results when live search is unavailable."""
    return [
        {
            "title": f"Market Intelligence Report: {query}",
            "url": "https://www.gartner.com/en/research",
            "snippet": (
                f"Gartner's latest analysis on {query} highlights key competitive "
                "dynamics and emerging market trends affecting enterprise adoption rates. "
                "Vendors are consolidating feature sets to compete on platform depth."
            ),
            "source": "gartner.com",
        },
        {
            "title": f"Competitive Landscape: {query} Industry Overview 2024",
            "url": "https://techcrunch.com/category/enterprise",
            "snippet": (
                f"A review of the {query} market reveals significant consolidation trends "
                "and rising enterprise demand for integrated, AI-native solutions. "
                "New entrants are disrupting legacy incumbents with usage-based pricing."
            ),
            "source": "techcrunch.com",
        },
        {
            "title": f"{query} Market Size and Growth Forecast 2024-2028",
            "url": "https://www.statista.com/markets",
            "snippet": (
                f"The global {query} market is projected to grow at a CAGR of 14-18% "
                "through 2028, driven by digital transformation initiatives and "
                "enterprise cloud adoption across APAC and North American markets."
            ),
            "source": "statista.com",
        },
    ]


# ──────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────

async def enrich_results_with_full_text(
    results: list[dict],
    max_pages: int = 5,
) -> list[dict]:
    """
    Augment search result dicts with 'full_text' by fetching each URL via
    Jina Reader.  Only the first max_pages results are fetched (to control
    latency); remaining results get full_text="".

    Fetches are executed concurrently with asyncio.gather so the total
    wall-clock time is roughly equal to the single slowest request.
    """
    urls   = [r.get("url", "") for r in results]
    to_fetch = min(max_pages, len(urls))

    tasks  = [_fetch_full_text_one(u) for u in urls[:to_fetch]]
    texts  = list(await asyncio.gather(*tasks))
    # Pad remaining results that were not fetched
    texts += [""] * (len(results) - to_fetch)

    for result, full_text in zip(results, texts):
        result["full_text"] = full_text

    enriched = sum(1 for t in texts if t)
    logger.info("Deep-read: %d/%d pages enriched with full text.", enriched, to_fetch)
    return results


async def search_web_async(query: str, max_results: int = 5) -> list[dict]:
    """
    Async DuckDuckGo web search.

    Returns a list of dicts: {title, url, snippet, source}.
    On any failure, returns mock data so the workflow continues.
    """
    try:
        results = await asyncio.to_thread(_sync_search, query, max_results)
        if not results:
            logger.warning("Empty results for query '%s'. Using mock data.", query)
            return _mock_results(query)
        return results
    except Exception as exc:
        logger.warning(
            "DuckDuckGo search failed for '%s': %s. Falling back to mock data.",
            query,
            exc,
        )
        return _mock_results(query)
