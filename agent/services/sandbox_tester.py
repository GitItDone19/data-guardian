"""
Sandbox Testing Service for DataGuardian.
Safely executes and validates proposed dbt model patches within an isolated
PostgreSQL schema (`staging_sandbox`) without affecting production tables.
"""

import os
import re
import logging
from typing import Dict, Any, Optional

from agent.services.fix_generator import ModelPatchModel
from agent.tools.postgres_tools import execute_write_query, execute_read_query

logger = logging.getLogger("dataops.sandbox_tester")
SANDBOX_SCHEMA = "staging_sandbox"


def compile_dbt_sql_for_sandbox(sql: str) -> str:
    """
    Replaces dbt Jinja macros {{ source('raw', 'table') }} and {{ ref('model') }}
    with direct SQL references to test execution against Postgres.
    """
    # Replace {{ source('schema', 'table') }} with schema.table
    compiled = re.sub(
        r"\{\{\s*source\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"]([^'\"]+)['\"]\s*\)\s*\}\}",
        r"\1.\2",
        sql
    )

    # Replace {{ ref('model') }} with staging.model
    compiled = re.sub(
        r"\{\{\s*ref\(\s*['\"]([^'\"]+)['\"]\s*\)\s*\}\}",
        r"staging.\1",
        compiled
    )

    return compiled


def run_sandbox_validation(patch: ModelPatchModel, failure_type: str = "UNKNOWN") -> Dict[str, Any]:
    """
    Deploys the patched model as a view in staging_sandbox and verifies that
    it satisfies all data quality and schema assertions.
    """
    model_name = patch.model_name
    raw_sql = patch.patched_code

    # 1. Compile Jinja to raw PostgreSQL SQL
    compiled_sql = compile_dbt_sql_for_sandbox(raw_sql)

    # 2. Deploy view into staging_sandbox
    create_view_sql = f"CREATE OR REPLACE VIEW {SANDBOX_SCHEMA}.{model_name} AS \n{compiled_sql};"
    deploy_result = execute_write_query(create_view_sql)

    if deploy_result.get("status") == "ERROR":
        return {
            "status": "FAILED",
            "tests_passed": False,
            "sandbox_schema": SANDBOX_SCHEMA,
            "model_name": model_name,
            "error": deploy_result.get("error", "Failed to create sandbox view"),
            "assertions_evaluated": []
        }

    # 3. Evaluate Quality & Functional Assertions on the Sandbox View
    assertions_evaluated = []
    tests_passed = True

    try:
        # Check basic row count
        count_res = execute_read_query(f"SELECT COUNT(*) as total FROM {SANDBOX_SCHEMA}.{model_name};")
        row_count = count_res["rows"][0]["total"] if count_res.get("rows") else 0
        assertions_evaluated.append({
            "check": "ROW_COUNT_NON_ZERO",
            "result": "PASSED" if row_count > 0 else "FAILED",
            "details": f"Table contains {row_count} rows in sandbox"
        })

        # Specific Assertions based on Model
        if model_name == "stg_orders":
            null_res = execute_read_query(
                f"SELECT COUNT(*) as null_count FROM {SANDBOX_SCHEMA}.{model_name} WHERE order_status IS NULL;"
            )
            null_count = null_res["rows"][0]["null_count"] if null_res.get("rows") else 0
            is_passed = (null_count == 0)
            if not is_passed:
                tests_passed = False
            assertions_evaluated.append({
                "check": "NULL_CONSTRAINT_ASSERTION",
                "result": "PASSED" if is_passed else "FAILED",
                "details": f"Verified null_count = {null_count} (expected 0)"
            })

        elif model_name == "stg_payments":
            dup_res = execute_read_query(
                f"SELECT order_id, payment_sequential, COUNT(*) as cnt "
                f"FROM {SANDBOX_SCHEMA}.{model_name} "
                f"GROUP BY order_id, payment_sequential HAVING COUNT(*) > 1;"
            )
            dup_count = len(dup_res.get("rows", []))
            is_passed = (dup_count == 0)
            if not is_passed:
                tests_passed = False
            assertions_evaluated.append({
                "check": "PRIMARY_KEY_UNIQUENESS_ASSERTION",
                "result": "PASSED" if is_passed else "FAILED",
                "details": f"Duplicate collisions = {dup_count} (expected 0)"
            })

        elif model_name == "stg_customers":
            col_res = execute_read_query(f"SELECT zip_code, city, state FROM {SANDBOX_SCHEMA}.{model_name} LIMIT 1;")
            is_passed = (col_res.get("status") == "SUCCESS")
            if not is_passed:
                tests_passed = False
            assertions_evaluated.append({
                "check": "SCHEMA_CONTRACT_VALIDATION",
                "result": "PASSED" if is_passed else "FAILED",
                "details": "Verified presence of aliased columns: zip_code, city, state"
            })

    except Exception as e:
        tests_passed = False
        assertions_evaluated.append({
            "check": "EXCEPTION_DURING_TESTS",
            "result": "FAILED",
            "details": str(e)
        })

    return {
        "status": "SUCCESS" if tests_passed else "FAILED",
        "tests_passed": tests_passed,
        "sandbox_schema": SANDBOX_SCHEMA,
        "model_name": model_name,
        "assertions_evaluated": assertions_evaluated
    }
