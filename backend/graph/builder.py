"""
Assembles and compiles the market analysis LangGraph StateGraph.

Topology (2-phase competitor analysis):
  market_scan → [competitor_select | END]
             → [planner | END]
             → researcher
             → graph_structuring
             → reporter
             → END

Phase 1 (market_scan):  broad scan, 5+ competitors with metadata
Phase 2 (competitor_select): select 2-3 most threatening, build deep profiles
"""
from __future__ import annotations

from langgraph.graph import END, StateGraph

from backend.graph.edges import route_after_market_scan, route_on_error
from backend.graph.nodes import (
    competitor_select_node,
    graph_structuring_node,
    market_scan_node,
    planner_node,
    reporter_node,
    researcher_node,
)
from backend.graph.state import AgentState


def build_graph():
    """Builds and compiles the LangGraph workflow. Returns a CompiledGraph."""
    workflow = StateGraph(AgentState)

    # Register nodes
    workflow.add_node("market_scan",        market_scan_node)
    workflow.add_node("competitor_select",  competitor_select_node)
    workflow.add_node("planner",            planner_node)
    workflow.add_node("researcher",         researcher_node)
    workflow.add_node("graph_structuring",  graph_structuring_node)
    workflow.add_node("reporter",           reporter_node)

    # Entry point
    workflow.set_entry_point("market_scan")

    # Conditional edges
    workflow.add_conditional_edges(
        "market_scan",
        route_after_market_scan,
        {"continue": "competitor_select", "end": END},
    )
    workflow.add_conditional_edges(
        "competitor_select",
        route_on_error,
        {"continue": "planner", "end": END},
    )
    workflow.add_conditional_edges(
        "planner",
        route_on_error,
        {"continue": "researcher", "end": END},
    )
    workflow.add_conditional_edges(
        "researcher",
        route_on_error,
        {"continue": "graph_structuring", "end": END},
    )
    workflow.add_conditional_edges(
        "graph_structuring",
        route_on_error,
        {"continue": "reporter", "end": END},
    )
    workflow.add_edge("reporter", END)

    return workflow.compile()
