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
    node_test_sandbox,
    node_human_approval_gate,
    node_apply_approved_fix,
    node_handle_rejection
)


def route_after_approval(state: IncidentState) -> str:
    """
    Conditional routing edge from human_approval_gate:
    - If approved: proceed to apply_approved_fix
    - If rejected: proceed to handle_rejection
    - If undecided: pause at END (state remains WAITING_FOR_APPROVAL)
    """
    approved = state.get("human_approved")
    if approved is True:
        return "apply_approved_fix"
    elif approved is False:
        return "handle_rejection"
    return END


def build_dataops_graph(checkpointer=None, interrupt_before=None):
    """
    Constructs and compiles the DataGuardian LangGraph state machine
    with Human-in-the-Loop (HITL) approval gates.
    """
    # 1. Initialize StateGraph with our custom TypedDict
    workflow = StateGraph(IncidentState)

    # 2. Add Reasoning, Patch Generation, Sandbox & HITL Nodes
    workflow.add_node("triage", node_triage)
    workflow.add_node("investigate_logs", node_investigate_logs)
    workflow.add_node("analyze_schema", node_analyze_schema)
    workflow.add_node("inspect_data", node_inspect_data)
    workflow.add_node("generate_rca", node_generate_rca)
    workflow.add_node("generate_fix", node_generate_fix)
    workflow.add_node("test_sandbox", node_test_sandbox)
    workflow.add_node("human_approval_gate", node_human_approval_gate)
    workflow.add_node("apply_approved_fix", node_apply_approved_fix)
    workflow.add_node("handle_rejection", node_handle_rejection)

    # 3. Sequential Reasoning & Remediation Edges
    workflow.add_edge(START, "triage")
    workflow.add_edge("triage", "investigate_logs")
    workflow.add_edge("investigate_logs", "analyze_schema")
    workflow.add_edge("analyze_schema", "inspect_data")
    workflow.add_edge("inspect_data", "generate_rca")
    workflow.add_edge("generate_rca", "generate_fix")
    workflow.add_edge("generate_fix", "test_sandbox")
    workflow.add_edge("test_sandbox", "human_approval_gate")

    # 4. Conditional Edge for Human-in-the-Loop Gate
    workflow.add_conditional_edges(
        "human_approval_gate",
        route_after_approval,
        {
            "apply_approved_fix": "apply_approved_fix",
            "handle_rejection": "handle_rejection",
            END: END
        }
    )

    workflow.add_edge("apply_approved_fix", END)
    workflow.add_edge("handle_rejection", END)

    # 5. Compile with Checkpointer and optional interrupts
    memory = checkpointer or MemorySaver()
    app = workflow.compile(
        checkpointer=memory,
        interrupt_before=interrupt_before
    )

    return app


# Singleton instance for quick execution
dataops_agent = build_dataops_graph()
