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
    node_generate_rca,
    node_generate_fix,
    node_test_sandbox
)


def build_dataops_graph(checkpointer=None):
    """
    Constructs and compiles the DataGuardian LangGraph state machine.
    """
    # 1. Initialize StateGraph with our custom TypedDict
    workflow = StateGraph(IncidentState)

    # 2. Add Reasoning, Patch Generation & Sandbox Nodes
    workflow.add_node("triage", node_triage)
    workflow.add_node("investigate_logs", node_investigate_logs)
    workflow.add_node("analyze_schema", node_analyze_schema)
    workflow.add_node("inspect_data", node_inspect_data)
    workflow.add_node("generate_rca", node_generate_rca)
    workflow.add_node("generate_fix", node_generate_fix)
    workflow.add_node("test_sandbox", node_test_sandbox)

    # 3. Define Sequential Reasoning & Remediation Edges
    workflow.add_edge(START, "triage")
    workflow.add_edge("triage", "investigate_logs")
    workflow.add_edge("investigate_logs", "analyze_schema")
    workflow.add_edge("analyze_schema", "inspect_data")
    workflow.add_edge("inspect_data", "generate_rca")
    workflow.add_edge("generate_rca", "generate_fix")
    workflow.add_edge("generate_fix", "test_sandbox")
    workflow.add_edge("test_sandbox", END)

    # 4. Compile with Checkpointer for persistent thread memory
    memory = checkpointer or MemorySaver()
    app = workflow.compile(checkpointer=memory)

    return app


# Singleton instance for quick execution
dataops_agent = build_dataops_graph()
