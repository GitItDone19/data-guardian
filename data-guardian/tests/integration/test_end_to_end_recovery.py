"""
End-to-End Integration Tests for DataGuardian (Phase 15).
Validates the complete autonomous DataOps recovery loop:
1. Incident detection and LangGraph thread initialization.
2. Sequential reasoning (logs, schema, data inspection) and RCA generation.
3. Patch generation and isolated sandbox validation.
4. Human-in-the-Loop gating (pause at WAITING_FOR_APPROVAL).
5. Human approval / rejection execution via FastAPI REST API.
6. Safe atomic patching, rollback verification, and incident resolution.
"""

import os
import sys
import tempfile
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from agent.graph.state import IncidentState
from agent.graph.graph import build_dataops_graph
from agent.tools.remediation_tools import (
    apply_model_patch,
    rollback_model_patch,
    record_incident_resolution
)
from backend.main import app

client = TestClient(app)


# =====================================================================
# Test 1: Full Autonomous Recovery Lifecycle (Agent State Machine)
# =====================================================================

def test_e2e_autonomous_incident_lifecycle():
    """
    Simulates a full end-to-end incident lifecycle:
    1. Incident ingested -> Agent starts investigation.
    2. RCA generated with high confidence.
    3. Patch created and verified in sandbox.
    4. Halts at WAITING_FOR_APPROVAL.
    5. Human approves -> Fix applied and marked RESOLVED.
    """
    thread_id = "e2e_test_lifecycle_001"
    agent_app = build_dataops_graph()
    config = {"configurable": {"thread_id": thread_id}}

    initial_state: IncidentState = {
        "incident_id": "INC_E2E_001",
        "pipeline_name": "ecommerce_pipeline",
        "raw_error": "Column customer_zip_code_prefix not found in raw.customers during dbt staging run.",
        "human_approved": None  # Initial state: undecided
    }

    # Step 1-4: Execute graph until the approval gate
    state_after_investigation = agent_app.invoke(initial_state, config=config)

    # Agent should halt at the Human-in-the-Loop gate
    assert state_after_investigation["status"] == "WAITING_FOR_APPROVAL"
    assert state_after_investigation.get("failure_type") is not None
    assert state_after_investigation.get("target_table") is not None
    assert state_after_investigation.get("root_cause_analysis") is not None
    assert state_after_investigation.get("proposed_model_patch") is not None
    assert state_after_investigation.get("sandbox_test_result") is not None

    # Step 5: Simulate human reviewing and approving the fix
    mock_conn = MagicMock()
    mock_engine = MagicMock()
    mock_engine.begin.return_value.__enter__.return_value = mock_conn

    with patch("agent.tools.remediation_tools.get_engine", return_value=mock_engine), \
         patch("agent.graph.nodes.apply_model_patch") as mock_apply, \
         patch("agent.graph.nodes.record_incident_resolution") as mock_record:
        
        mock_apply.return_value = {
            "status": "SUCCESS",
            "target_file": "dbt/models/staging/stg_customers.sql",
            "backup_path": "dbt/.backups/stg_customers.sql.bak",
            "bytes_written": 270
        }
        mock_record.return_value = {
            "status": "SUCCESS",
            "resolution": "RESOLVED",
            "incident_id": "INC_E2E_001"
        }

        resume_state = {
            "incident_id": "INC_E2E_001",
            "human_approved": True
        }
        final_state = agent_app.invoke(resume_state, config=config)

        assert final_state["status"] == "RESOLVED"
        assert final_state["human_approved"] is True
        assert final_state.get("remediation_result") is not None


# =====================================================================
# Test 2: Human-in-the-Loop Rejection Safety Gate
# =====================================================================

def test_e2e_rejection_safety_lifecycle():
    """
    Validates that when a human operator rejects the proposed fix:
    - State transitions safely to REJECTED.
    - No file patches or mutations are executed.
    - Incident status records human rejection.
    """
    thread_id = "e2e_test_rejection_002"
    agent_app = build_dataops_graph()
    config = {"configurable": {"thread_id": thread_id}}

    initial_state: IncidentState = {
        "incident_id": "INC_E2E_002",
        "pipeline_name": "ecommerce_pipeline",
        "raw_error": "Null value spike detected in raw.orders order_status.",
        "human_approved": None
    }

    # Run up to approval gate
    paused_state = agent_app.invoke(initial_state, config=config)
    assert paused_state["status"] == "WAITING_FOR_APPROVAL"

    # Human explicitly rejects the patch
    resume_state = {
        "incident_id": "INC_E2E_002",
        "human_approved": False
    }
    rejected_state = agent_app.invoke(resume_state, config=config)

    assert rejected_state["status"] == "REJECTED"
    assert rejected_state["human_approved"] is False
    assert "rejected" in rejected_state.get("error_message", "").lower()


# =====================================================================
# Test 3: FastAPI Backend Operator Workflow
# =====================================================================

def test_e2e_fastapi_operator_workflow():
    """
    Tests the complete operator workflow through the FastAPI management backend:
    1. Check pipeline health metrics.
    2. Triage incident via POST /api/incidents/{id}/triage.
    3. Approve incident fix via POST /api/incidents/{id}/approve.
    """
    # 1. Pipeline status check
    status_resp = client.get("/api/pipelines/status")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert "dag_id" in status_data
    assert "status" in status_data

    # Mock incident lookup for triage endpoint
    mock_incident_data = {
        "status": "SUCCESS",
        "incident": {
            "incident_id": "INC_API_E2E",
            "pipeline_name": "ecommerce_pipeline",
            "status": "OPEN",
            "error_summary": "Schema drift: column postal_code_drifted in raw.customers"
        },
        "audit_events": []
    }

    with patch("backend.api.routes.get_incident_details", return_value=mock_incident_data):
        # 2. Triage incident
        triage_resp = client.post("/api/incidents/INC_API_E2E/triage")
        assert triage_resp.status_code == 200
        triage_data = triage_resp.json()
        assert triage_data["status"] == "WAITING_FOR_APPROVAL"
        assert triage_data["incident_id"] == "INC_API_E2E"

        # 3. Approve incident fix
        with patch("agent.tools.remediation_tools.get_engine"), \
             patch("agent.graph.nodes.apply_model_patch") as mock_apply:
            mock_apply.return_value = {
                "status": "SUCCESS",
                "target_file": "dbt/models/staging/stg_customers.sql",
                "backup_path": "dbt/.backups/stg_customers.sql.bak",
                "bytes_written": 270
            }
            approve_resp = client.post(
                "/api/incidents/INC_API_E2E/approve",
                json={"action": "approve", "notes": "Approved in E2E integration test"}
            )
            assert approve_resp.status_code == 200
            approve_data = approve_resp.json()
            assert approve_data["status"] == "RESOLVED"
            assert approve_data["action"] == "approve"


# =====================================================================
# Test 4: Atomic Backup, Patch Application, and Rollback
# =====================================================================

def test_e2e_patch_atomic_safety_and_rollback():
    """
    Ensures safe file mutation mechanics in a real filesystem environment:
    - Original code is backed up with timestamped .bak copy.
    - Patched code is applied accurately.
    - Rollback completely restores identical byte-for-byte content.
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        model_path = os.path.join(tmp_dir, "stg_payments.sql")
        original_sql = (
            "with source as (\n"
            "    select * from raw.payments\n"
            ")\n"
            "select payment_id, payment_value from source;\n"
        )
        patched_sql = (
            "with source as (\n"
            "    select * from raw.payments\n"
            ")\n"
            "select payment_id, coalesce(payment_value, 0.0) as payment_value from source;\n"
        )

        with open(model_path, "w", encoding="utf-8") as f:
            f.write(original_sql)

        # 1. Apply patch
        patch_result = apply_model_patch(model_path, patched_sql)
        assert patch_result["status"] == "SUCCESS"
        backup_file = patch_result["backup_path"]
        assert os.path.exists(backup_file)

        # Verify patch applied
        with open(model_path, "r", encoding="utf-8") as f:
            current_content = f.read()
        assert current_content == patched_sql

        # 2. Rollback patch
        rollback_result = rollback_model_patch(model_path, backup_file)
        assert rollback_result["status"] == "SUCCESS"

        # Verify exact restoration
        with open(model_path, "r", encoding="utf-8") as f:
            restored_content = f.read()
        assert restored_content == original_sql
