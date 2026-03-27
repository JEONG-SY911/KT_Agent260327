"""
Builds the deep-dive focused analysis LangGraph.

Topology (2-node linear pipeline):
  targeted_researcher  ->  report_generator  ->  END
"""
from __future__ import annotations

from langgraph.graph import END, StateGraph

from backend.graph.deep_dive_nodes import report_generator_node, targeted_researcher_node
from backend.graph.deep_dive_state import DeepDiveState


def build_deep_dive_graph():
    graph = StateGraph(DeepDiveState)

    graph.add_node("targeted_researcher", targeted_researcher_node)
    graph.add_node("report_generator", report_generator_node)

    graph.set_entry_point("targeted_researcher")
    graph.add_edge("targeted_researcher", "report_generator")
    graph.add_edge("report_generator", END)

    return graph.compile()
