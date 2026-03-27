"""
LangGraph TypedDict state for the deep-dive focused analysis workflow.

Operates on 1-3 pre-selected companies; intentionally lighter than AgentState.
mode is set at graph entry:
  "single"     - 1 company selected  -> single_report is populated
  "comparison" - 2+ companies        -> comparison_report is populated
"""
from __future__ import annotations

from typing import Optional

from typing_extensions import TypedDict


class DeepDiveState(TypedDict):
    # ── Input ─────────────────────────────────────────────────────────
    company_names: list[str]        # 1 = single mode, 2-3 = comparison mode
    product_description: str        # original product context
    mode: str                       # "single" | "comparison"

    # ── Targeted research output ──────────────────────────────────────
    # Each entry: {title, url, snippet, source, keyword, target_company}
    raw_research: list[dict]

    # ── Report output (only one is populated depending on mode) ───────
    single_report: dict             # SingleDeepDiveReport.model_dump()
    comparison_report: dict         # ComparisonReport.model_dump()

    # ── Workflow control ──────────────────────────────────────────────
    current_stage: str
    error: Optional[str]
