"""
LangGraph TypedDict state for the market analysis multi-agent workflow.
All fields must be serializable to JSON for SSE streaming.
"""
from __future__ import annotations

from typing import Optional

from typing_extensions import TypedDict


class AgentState(TypedDict):
    # ── Input ─────────────────────────────────────────────────────────
    product_description: str

    # ── Phase 1: Market Scan output ───────────────────────────────────
    is_valid_input: bool
    fallback_message: str
    market_overview: str
    # Each item matches Phase1CompetitorItem.model_dump() — 5+ entries
    phase1_competitors: list[dict]

    # ── Phase 2: Competitor Selection output ──────────────────────────
    market_positioning: str
    # Deep profiles for the 2-3 selected competitors
    competitors: list[dict]

    # ── Planner Agent output ──────────────────────────────────────────
    search_keywords: list[str]
    analysis_rationale: str

    # ── Web Researcher output ─────────────────────────────────────────
    # Each entry: {title, url, snippet, source, keyword}
    raw_research: list[dict]

    # ── Graph Structuring output ──────────────────────────────────────
    knowledge_graph: dict  # {"nodes": [...], "edges": [...]}
    graph_insights: list[str]

    # ── Reporter output ───────────────────────────────────────────────
    final_report: dict  # Matches ReporterOutput.model_dump()

    # ── Workflow control ──────────────────────────────────────────────
    current_stage: str
    error: Optional[str]
