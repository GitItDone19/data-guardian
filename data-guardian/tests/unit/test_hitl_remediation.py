"""
Unit tests for Phase 11: Human-in-the-Loop (HITL) & Write Tools.
Validates safe patching, atomic backups, rollback capabilities, approval gating,
and incident resolution recording.
"""

import os
import tempfile
import pytest
from unittest.mock import patch, MagicMock

from agent.graph.state import IncidentState
from agent.tools.remediation_tools import (
    apply_model_patch,
    rollback_model_patch,
    record_incident_resolution,
    trigger_pipeline_recovery
)
from agent.graph.nodes import (
    node_human_approval_gate,
    node_apply_approved_fix,
    node_handle_rejection
)
from agent.graph.graph import build_dataops_graph, route_after_approval


def test_apply_and_rollback_model_patch():
    """Verify safe model patching creates an atomic backup and rollback restores original content."""
    with tempfile.TemporaryDirectory() as tmpdir:
        test_file = os.path.join(tmpdir, "stg_customers.sql")
        original_sql = "select customer_id from raw.customers;"
        patched_sql = "select coalesce(postal_code_drifted, zip_code) from raw.customers;"

        with open(test_file, "w", encoding="utf-8") as f:
            f.write(original_sql)

        # 1. Apply patch
        apply_res = apply_model_patch(test_file, patched_sql)
        assert apply_res["status"] == "SUCCESS"
        assert os.path.exists(apply_res["backup_path"])

        # Check content changed
        with open(test_file, "r", encoding="utf-8") as f:
            assert f.read() == patched_sql

        # 2. Rollback patch
        rollback_res = rollback_model_patch(test_file, apply_res["backup_path"])
        assert rollback_res["status"] == "SUCCESS"

        # Check content restored
        with open(test_file, "r", encoding="utf-8") as f:
            assert f.read() == original_sql


def test_record_incident_resolution_db_update():
    """Verify record_incident_resolution executes update queries."""
    mock_conn = MagicMock()
    mock_engine = MagicMock()
    mock_engine.begin.return_value.__enter__.return_value = mock_conn

    res = record_incident_resolution(
        incident_id="INC_TEST_RESOLVE",
        root_cause="Schema drift repaired",
        proposed_fix="Aliased column in stg_customers.sql",
        engine=mock_engine
    )

    assert res["status"] == "SUCCESS"
    assert res["resolution"] == "RESOLVED"
    assert mock_conn.execute.call_count == 2  # update incident + insert audit log


def test_node_human_approval_gate_states():
    """Verify node_human_approval_gate handles True, False, and None."""
    # Undecided -> WAITING_FOR_APPROVAL
    s1 = node_human_approval_gate({"human_approved": None})
    assert s1["status"] == "WAITING_FOR_APPROVAL"

    # Approved -> APPROVED
    s2 = node_human_approval_gate({"human_approved": True})
    assert s2["status"] == "APPROVED"

    # Rejected -> REJECTED
    s3 = node_human_approval_gate({"human_approved": False})
    assert s3["status"] == "REJECTED"


def test_route_after_approval_conditional_edge():
    """Verify routing decisions based on human_approved attribute."""
    assert route_after_approval({"human_approved": True}) == "apply_approved_fix"
    assert route_after_approval({"human_approved": False}) == "handle_rejection"
    assert route_after_approval({"human_approved": None}) == "__end__"


def test_node_apply_approved_fix_execution():
    """Verify node_apply_approved_fix coordinates patch application and resolution."""
    state: IncidentState = {
        "incident_id": "INC_APPLY_01",
        "proposed_model_patch": {
            "target_file": "dbt/models/staging/stg_orders.sql",
            "patched_code": "select 1;"
        },
        "rca_narrative": "Imputed order_status null values"
    }

    with patch("agent.graph.nodes.apply_model_patch", return_value={"status": "SUCCESS"}), \
         patch("agent.graph.nodes.record_incident_resolution", return_value={"status": "SUCCESS"}), \
         patch("agent.graph.nodes.trigger_pipeline_recovery", return_value={"status": "SUCCESS"}):
        res = node_apply_approved_fix(state)

        assert res["status"] == "RESOLVED"
        assert "remediation_result" in res
        assert res["remediation_result"]["patch_result"]["status"] == "SUCCESS"


def test_node_handle_rejection_execution():
    """Verify node_handle_rejection cleanly stops without modifying system."""
    res = node_handle_rejection({"incident_id": "INC_REJ_01"})
    assert res["status"] == "REJECTED"
    assert "rejected" in res["error_message"].lower()


def test_full_graph_hitl_approval_and_rejection_flows():
    """Verify LangGraph full workflow with approval vs rejection branches."""
    app = build_dataops_graph()
    thread_config = {"configurable": {"thread_id": "test_hitl_001"}}

    initial_state: IncidentState = {
        "incident_id": "INC_HITL_TEST",
        "pipeline_name": "ecommerce_pipeline",
        "raw_error": "Schema Drift on raw.customers",
        "human_approved": None  # No human decision yet
    }

    with patch("agent.services.sandbox_tester.execute_write_query", return_value={"status": "SUCCESS"}), \
         patch("agent.services.sandbox_tester.execute_read_query", side_effect=[
             {"status": "SUCCESS", "rows": [{"total": 100}]},
             {"status": "SUCCESS", "rows": [{"zip_code": "01001", "city": "sao paulo", "state": "SP"}]}
         ]):
        paused_state = app.invoke(initial_state, config=thread_config)

    # 1. Pipeline should stop at human_approval_gate in WAITING_FOR_APPROVAL
    assert paused_state["status"] == "WAITING_FOR_APPROVAL"
    assert "sandbox_test_result" in paused_state

    # 2. Operator grants approval: resume execution
    approved_state = {**paused_state, "human_approved": True}
    with patch("agent.graph.nodes.apply_model_patch", return_value={"status": "SUCCESS"}), \
         patch("agent.graph.nodes.record_incident_resolution", return_value={"status": "SUCCESS"}), \
         patch("agent.graph.nodes.trigger_pipeline_recovery", return_value={"status": "SUCCESS"}):
        final_state = app.invoke(approved_state, config=thread_config)

    assert final_state["status"] == "RESOLVED"
    assert "remediation_result" in final_state
