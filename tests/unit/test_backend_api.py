"""
Unit tests for Phase 12: FastAPI Management Backend.
Validates all REST API endpoints, response models, LangGraph agent triggers,
and human approval routes using FastAPI TestClient.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["platform"] == "DataGuardian"
    assert "version" in data


def test_health_check_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "HEALTHY"


def test_get_pipelines_status():
    with patch("backend.api.routes.get_pipeline_overview") as mock_overview, \
         patch("backend.api.routes.get_open_incidents") as mock_open:

        mock_overview.return_value = {
            "status": "SUCCESS",
            "dag_id": "ecommerce_pipeline",
            "schedule": "@daily",
            "task_count": 4,
            "tasks": [
                {"task_id": "ingest_raw_data", "type": "PythonOperator", "upstream": []},
                {"task_id": "dbt_run_staging", "type": "BashOperator", "upstream": ["ingest_raw_data"]}
            ]
        }
        mock_open.return_value = {
            "status": "SUCCESS",
            "open_count": 1,
            "incidents": [
                {
                    "incident_id": "INC_TEST_001",
                    "pipeline_name": "ecommerce_pipeline",
                    "status": "OPEN",
                    "error_summary": "Null rate spike in orders"
                }
            ]
        }

        response = client.get("/api/pipelines/status")
        assert response.status_code == 200
        data = response.json()
        assert data["dag_id"] == "ecommerce_pipeline"
        assert data["status"] == "DEGRADED"
        assert data["open_incidents_count"] == 1
        assert len(data["tasks"]) == 2


def test_list_incidents():
    mock_conn = MagicMock()
    mock_engine = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn

    mock_conn.execute.return_value.fetchall.return_value = [
        ("INC_001", "ecommerce_pipeline", "OPEN", "Null error", None, None),
        ("INC_002", "ecommerce_pipeline", "RESOLVED", "Schema error", None, None)
    ]

    with patch("backend.api.routes.get_engine", return_value=mock_engine):
        # 1. Without filter
        res = client.get("/api/incidents")
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 2
        assert items[0]["incident_id"] == "INC_001"

        # 2. With filter
        res_filtered = client.get("/api/incidents?status=OPEN")
        assert res_filtered.status_code == 200


def test_get_incident_detail():
    with patch("backend.api.routes.get_incident_details") as mock_details:
        mock_details.return_value = {
            "status": "SUCCESS",
            "incident": {
                "incident_id": "INC_DETAIL_001",
                "pipeline_name": "ecommerce_pipeline",
                "status": "OPEN",
                "error_summary": "Schema drift detected",
                "root_cause": None,
                "proposed_fix": None,
                "created_at": None,
                "updated_at": None
            },
            "audit_events": [
                {"log_id": 1, "action_type": "TRIAGE", "tool_name": "describe_table"}
            ]
        }

        response = client.get("/api/incidents/INC_DETAIL_001")
        assert response.status_code == 200
        data = response.json()
        assert data["incident_id"] == "INC_DETAIL_001"
        assert len(data["audit_events"]) == 1

        # Test 404 when incident missing
        mock_details.return_value = {"status": "ERROR", "error": "Not found"}
        res_404 = client.get("/api/incidents/NON_EXISTENT")
        assert res_404.status_code == 404


def test_triage_incident_endpoint():
    with patch("backend.api.routes.get_incident_details") as mock_details, \
         patch("backend.api.routes.agent_app.invoke") as mock_agent_invoke:

        mock_details.return_value = {
            "status": "SUCCESS",
            "incident": {
                "incident_id": "INC_TRIAGE_001",
                "pipeline_name": "ecommerce_pipeline",
                "error_summary": "Null rate spike in raw.orders"
            }
        }
        mock_agent_invoke.return_value = {
            "status": "WAITING_FOR_APPROVAL",
            "failure_type": "DATA_QUALITY_ANOMALY",
            "target_table": "raw.orders",
            "rca_narrative": "Verified null spike in order_status",
            "confidence_score": 0.96,
            "sandbox_test_result": {"tests_passed": True}
        }

        response = client.post("/api/incidents/INC_TRIAGE_001/triage")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "WAITING_FOR_APPROVAL"
        assert data["failure_type"] == "DATA_QUALITY_ANOMALY"
        assert data["sandbox_test_result"]["tests_passed"] is True


def test_approve_incident_fix():
    with patch("backend.api.routes.agent_app.invoke") as mock_invoke:
        mock_invoke.return_value = {
            "status": "RESOLVED",
            "remediation_result": {"patch_result": {"status": "SUCCESS"}}
        }

        # 1. Approve
        res = client.post(
            "/api/incidents/INC_APPROVE_001/approve",
            json={"action": "approve", "reviewer_notes": "Fix verified in sandbox"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["action"] == "approve"
        assert data["status"] == "RESOLVED"

        # 2. Reject
        mock_invoke.return_value = {"status": "REJECTED"}
        res_rej = client.post(
            "/api/incidents/INC_APPROVE_001/approve",
            json={"action": "reject", "reviewer_notes": "Wait for upstream DBA"}
        )
        assert res_rej.status_code == 200
        data_rej = res_rej.json()
        assert data_rej["action"] == "reject"
        assert data_rej["status"] == "REJECTED"


def test_simulate_scenario_endpoint():
    with patch("backend.api.routes.inject_null_spike", return_value=True), \
         patch("backend.api.routes.reset_clean_data", return_value=True):

        # Test null spike simulation
        res1 = client.post("/api/simulate", json={"scenario": "null_spike"})
        assert res1.status_code == 200
        assert res1.json()["status"] == "SUCCESS"
        assert res1.json()["scenario"] == "null_spike"

        # Test reset
        res2 = client.post("/api/simulate", json={"scenario": "reset"})
        assert res2.status_code == 200
        assert res2.json()["status"] == "SUCCESS"
