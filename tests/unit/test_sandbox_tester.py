"""
Unit tests for Phase 10: Sandbox Testing Service.
Validates dbt SQL Jinja compilation and sandbox assertion evaluations.
"""

import pytest
from unittest.mock import patch, MagicMock
from agent.graph.state import IncidentState
from agent.services.fix_generator import ModelPatchModel, generate_model_patch
from agent.services.sandbox_tester import compile_dbt_sql_for_sandbox, run_sandbox_validation
from agent.graph.nodes import node_generate_fix, node_test_sandbox


def test_compile_dbt_sql_for_sandbox():
    sql = "with source as (select * from {{ source('raw', 'customers') }}) select * from {{ ref('stg_orders') }}"
    compiled = compile_dbt_sql_for_sandbox(sql)

    assert "{{ source" not in compiled
    assert "{{ ref" not in compiled
    assert "raw.customers" in compiled
    assert "staging.stg_orders" in compiled


def test_test_patch_in_sandbox_passes_all_checks():
    patch_model = ModelPatchModel(
        model_name="stg_orders",
        target_file="dbt/models/staging/stg_orders.sql",
        strategy="IMPUTE_NULLS",
        original_code="select * from {{ source('raw', 'orders') }}",
        patched_code="select * from {{ source('raw', 'orders') }}",
        patch_diff="",
        explanation="Test patch"
    )

    with patch("agent.services.sandbox_tester.execute_write_query", return_value={"status": "SUCCESS"}), \
         patch("agent.services.sandbox_tester.execute_read_query", side_effect=[
             {"status": "SUCCESS", "rows": [{"total": 100}]},         # row count check
             {"status": "SUCCESS", "rows": [{"null_count": 0}]}       # null check
         ]):
        res = run_sandbox_validation(patch_model, failure_type="DATA_QUALITY_ANOMALY")

        assert res["status"] == "SUCCESS"
        assert res["tests_passed"] is True
        assert res["sandbox_schema"] == "staging_sandbox"
        assert len(res["assertions_evaluated"]) >= 2
        assert any(a["check"] == "NULL_CONSTRAINT_ASSERTION" and a["result"] == "PASSED" for a in res["assertions_evaluated"])


def test_test_patch_in_sandbox_fails_when_nulls_remain():
    patch_model = ModelPatchModel(
        model_name="stg_orders",
        target_file="dbt/models/staging/stg_orders.sql",
        strategy="IMPUTE_NULLS",
        original_code="select * from {{ source('raw', 'orders') }}",
        patched_code="select * from {{ source('raw', 'orders') }}",
        patch_diff="",
        explanation="Test patch"
    )

    with patch("agent.services.sandbox_tester.execute_write_query", return_value={"status": "SUCCESS"}), \
         patch("agent.services.sandbox_tester.execute_read_query", side_effect=[
             {"status": "SUCCESS", "rows": [{"total": 100}]},
             {"status": "SUCCESS", "rows": [{"null_count": 5}]}       # 5 nulls still remain!
         ]):
        res = run_sandbox_validation(patch_model, failure_type="DATA_QUALITY_ANOMALY")

        assert res["status"] == "FAILED"
        assert res["tests_passed"] is False


def test_node_generate_fix_and_test_sandbox_chain():
    state: IncidentState = {
        "incident_id": "INC_CHAIN_001",
        "failure_type": "DATA_QUALITY_ANOMALY",
        "target_table": "raw.orders",
        "raw_error": "Null spike in raw.orders"
    }

    # Run Node 6: generate_fix
    fix_state = node_generate_fix(state)
    assert fix_state["status"] == "FIX_GENERATED"
    assert "proposed_model_patch" in fix_state
    assert "coalesce" in fix_state["proposed_sql_fix"].lower()

    # Run Node 7: test_sandbox
    full_state = {**state, **fix_state}
    with patch("agent.services.sandbox_tester.execute_write_query", return_value={"status": "SUCCESS"}), \
         patch("agent.services.sandbox_tester.execute_read_query", side_effect=[
             {"status": "SUCCESS", "rows": [{"total": 50}]},
             {"status": "SUCCESS", "rows": [{"null_count": 0}]}
         ]):
        sandbox_state = node_test_sandbox(full_state)
        assert sandbox_state["status"] == "SANDBOX_VERIFIED"
        assert sandbox_state["sandbox_test_result"]["tests_passed"] is True

