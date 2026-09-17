"""
Unit tests for Phase 8: LangGraph State & Node Graph Definition.
Validates state transitions, node execution, RCA synthesis, and persistent checkpointer.
"""

import pytest
from unittest.mock import MagicMock, patch

from agent.graph.state import IncidentState
from agent.graph.nodes import (
    node_triage,
    node_investigate_logs,
    node_analyze_schema,
    node_inspect_data,
    node_generate_rca
)
from agent.graph.graph import build_dataops_graph


def test_incident_state_creation():
    state: IncidentState = {
        "incident_id": "INC_TEST_001",
        "pipeline_name": "ecommerce_pipeline",
        "raw_error": "Null rate anomaly in raw.orders: 45% nulls",
        "status": "TRIAGING"
    }
    assert state["incident_id"] == "INC_TEST_001"
    assert state["status"] == "TRIAGING"


def test_node_triage_detects_null_spike():
    state: IncidentState = {
        "incident_id": "INC_TEST_002",
        "raw_error": "Null rate anomaly in raw.orders.order_status exceeding 2.0%",
        "pipeline_name": "ecommerce_pipeline"
    }

    with patch("agent.graph.nodes.get_incident_details") as mock_details:
        mock_details.return_value = {"status": "ERROR"}
        res = node_triage(state)
        assert res["failure_type"] == "DATA_QUALITY_ANOMALY"
        assert res["target_table"] == "raw.orders"
        assert res["status"] == "INVESTIGATING"


def test_node_triage_detects_schema_drift():
    state: IncidentState = {
        "incident_id": "INC_TEST_003",
        "raw_error": "Schema Drift Detected in raw.customers! Missing required column(s): customer_zip_code_prefix",
        "pipeline_name": "ecommerce_pipeline"
    }

    with patch("agent.graph.nodes.get_incident_details") as mock_details:
        mock_details.return_value = {"status": "ERROR"}
        res = node_triage(state)
        assert res["failure_type"] == "SCHEMA_DRIFT"
        assert res["target_table"] == "raw.customers"


def test_node_analyze_schema_detects_drift():
    state: IncidentState = {
        "target_table": "raw.customers",
        "failure_type": "SCHEMA_DRIFT"
    }

    with patch("agent.graph.nodes.describe_table") as mock_describe, \
         patch("agent.graph.nodes.read_dbt_schema_contracts") as mock_contracts, \
         patch("agent.graph.nodes.read_dbt_model_code") as mock_code, \
         patch("agent.graph.nodes.get_model_dependencies") as mock_dep:

        # Simulate missing customer_zip_code_prefix
        mock_describe.return_value = {
            "columns": [
                {"column_name": "customer_id"},
                {"column_name": "customer_unique_id"},
                {"column_name": "postal_code_drifted"},
                {"column_name": "customer_city"},
                {"column_name": "customer_state"}
            ]
        }
        mock_contracts.return_value = {"status": "SUCCESS"}
        mock_code.return_value = {"status": "SUCCESS"}
        mock_dep.return_value = {"upstream_models": []}

        res = node_analyze_schema(state)
        evidence = res["schema_evidence"]
        assert evidence["has_schema_drift"] is True
        assert "customer_zip_code_prefix" in evidence["missing_expected_columns"]


def test_node_generate_rca_for_null_spike():
    state: IncidentState = {
        "incident_id": "INC_TEST_004",
        "failure_type": "DATA_QUALITY_ANOMALY",
        "target_table": "raw.orders",
        "raw_error": "Null rate anomaly in raw.orders.order_status",
        "data_evidence": {"corrupted_samples": [{"order_id": "1", "order_status": None}]}
    }

    res = node_generate_rca(state)
    assert res["status"] == "RCA_GENERATED"
    assert "Root Cause Analysis" in res["rca_narrative"]
    assert "stg_orders.sql" in res["proposed_sql_fix"]
    assert res["confidence_score"] >= 0.90


def test_full_graph_execution_end_to_end():
    """Verify end-to-end execution of the LangGraph state machine across all 5 nodes."""
    app = build_dataops_graph()

    initial_state: IncidentState = {
        "incident_id": "INC_E2E_001",
        "pipeline_name": "ecommerce_pipeline",
        "raw_error": "Schema Drift: column postal_code_drifted appeared, customer_zip_code_prefix missing in raw.customers"
    }

    config = {"configurable": {"thread_id": "test_thread_001"}}
    final_state = app.invoke(initial_state, config=config)

    assert final_state["status"] == "RCA_GENERATED"
    assert final_state["failure_type"] == "SCHEMA_DRIFT"
    assert final_state["target_table"] == "raw.customers"
    assert "schema_evidence" in final_state
    assert "root_cause_analysis" in final_state
    assert final_state["confidence_score"] is not None
