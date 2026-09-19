"""
Unit tests for Phase 10: Fix Generator Service.
Validates automated dbt model patch synthesis and unified diff creation.
"""

import pytest
from agent.graph.state import IncidentState
from agent.services.fix_generator import generate_model_patch, generate_diff, ModelPatchModel


def test_generate_diff_helper():
    original = "select 1 as a,\n       2 as b\n"
    patched = "select 1 as a,\n       3 as b\n"
    diff = generate_diff(original, patched, "test.sql")

    assert "--- a/test.sql" in diff
    assert "+++ b/test.sql" in diff
    assert "-       2 as b" in diff
    assert "+       3 as b" in diff


def test_generate_model_patch_schema_drift():
    state: IncidentState = {
        "incident_id": "INC_TEST_DRIFT",
        "failure_type": "SCHEMA_DRIFT",
        "target_table": "raw.customers",
        "raw_error": "Column customer_zip_code_prefix missing"
    }

    patch = generate_model_patch(state)

    assert isinstance(patch, ModelPatchModel)
    assert patch.model_name == "stg_customers"
    assert "coalesce(postal_code_drifted, customer_zip_code_prefix) as zip_code" in patch.patched_code
    assert "+++ b/stg_customers.sql" in patch.patch_diff
    assert len(patch.explanation) > 10


def test_generate_model_patch_null_spike():
    state: IncidentState = {
        "incident_id": "INC_TEST_NULLS",
        "failure_type": "DATA_QUALITY_ANOMALY",
        "target_table": "raw.orders",
        "raw_error": "Null rate spike in order_status"
    }

    patch = generate_model_patch(state)

    assert patch.model_name == "stg_orders"
    assert "coalesce(order_status, 'unknown') as order_status" in patch.patched_code
    assert "+++ b/stg_orders.sql" in patch.patch_diff


def test_generate_model_patch_duplicate_rows():
    state: IncidentState = {
        "incident_id": "INC_TEST_DUPS",
        "failure_type": "DATA_QUALITY_ANOMALY",
        "target_table": "raw.payments",
        "raw_error": "Duplicate composite key in raw.payments"
    }

    patch = generate_model_patch(state)

    assert patch.model_name == "stg_payments"
    assert "row_number() over" in patch.patched_code.lower()
    assert "partition by order_id, payment_sequential" in patch.patched_code.lower()
    assert "where rn = 1" in patch.patched_code.lower()
