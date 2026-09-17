"""
LangGraph Workflow Graph Definition for the DataGuardian AI Agent.
Assembles the state machine, sequential reasoning edges, and memory checkpointer.
"""

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from agent.graph.state import IncidentState
from agent.graph.nodes import (
    node_triage,
    node_investigate_logs,
    node_analyze_schema,
    node_inspect_data,
    node_generate_rca
)


def build_dataops_graph(checkpointer=None):
    """
    Constructs and compiles the DataGuardian LangGraph state machine.
    """
    # 1. Initialize StateGraph with our custom TypedDict
    workflow = StateGraph(IncidentState)

    # 2. Add Reasoning & Tool Execution Nodes
    workflow.add_node("triage", node_triage)
    workflow.add_node("investigate_logs", node_investigate_logs)
    workflow.add_node("analyze_schema", node_analyze_schema)
    workflow.add_node("inspect_data", node_inspect_data)
    workflow.add_node("generate_rca", node_generate_rca)

    # 3. Define Sequential Reasoning Edges
    workflow.add_edge(START, "triage")
    workflow.add_edge("triage", "investigate_logs")
    workflow.add_edge("investigate_logs", "analyze_schema")
    workflow.add_edge("analyze_schema", "inspect_data")
    workflow.add_edge("inspect_data", "generate_rca")
    workflow.add_edge("generate_rca", END)

    # 4. Compile with Checkpointer for persistent thread memory
    memory = checkpointer or MemorySaver()
    app = workflow.compile(checkpointer=memory)

    return app


# Singleton instance for quick execution
dataops_agent = build_dataops_graph()
