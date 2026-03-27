"""
Conditional edge routing functions for the market analysis LangGraph workflow.
"""
from __future__ import annotations

from backend.graph.state import AgentState


def route_after_market_scan(state: AgentState) -> str:
    """
    After the Market Scan node (Phase 1):
    - End if the user's input was insufficient for analysis.
    - End if an unexpected error occurred.
    - Otherwise continue to the Competitor Selection node (Phase 2).
    """
    if state.get("error"):
        return "end"
    if not state.get("is_valid_input", True):
        return "end"
    return "continue"


def route_on_error(state: AgentState) -> str:
    """
    Generic guard used after Competitor Selection, Planner, Researcher,
    and Graph Structuring nodes. Ends the workflow early if a node recorded an error.
    """
    if state.get("error"):
        return "end"
    return "continue"
