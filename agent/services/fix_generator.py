"""
Fix Generator Service for DataGuardian.
Generates syntactically valid dbt model SQL patches and unified diffs based on
evidence from the Root Cause Analysis (RCA).
"""

import os
import difflib
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

from agent.graph.state import IncidentState
from agent.tools.dbt_tools import read_dbt_model_code

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class ModelPatchModel(BaseModel):
    model_name: str
    target_file: str
    strategy: str
    original_code: str
    patched_code: str
    patch_diff: str
    explanation: str


def generate_diff(original: str, patched: str, filename: str) -> str:
    """Generates a readable unified diff format between original and patched code."""
    orig_lines = original.splitlines(keepends=True)
    patch_lines = patched.splitlines(keepends=True)
    diff = difflib.unified_diff(
        orig_lines,
        patch_lines,
        fromfile=f"a/{filename}",
        tofile=f"b/{filename}",
        n=3
    )
    return "".join(diff)


def generate_model_patch(state: IncidentState) -> ModelPatchModel:
    """
    Analyzes the incident state, identifies the target dbt model,
    and produces the patched SQL code and unified diff.
    """
    failure_type = state.get("failure_type", "UNKNOWN")
    target_table = state.get("target_table", "")
    rca = state.get("root_cause_analysis") or {}
    recommended_fix = rca.get("recommended_fix") or {}

    # Default targets based on table / incident
    if "customers" in target_table or failure_type == "SCHEMA_DRIFT":
        model_name = "stg_customers"
        strategy = "RENAME_COLUMN_ALIAS"
        target_file = "dbt/models/staging/stg_customers.sql"
    elif "orders" in target_table or "null" in state.get("raw_error", "").lower():
        model_name = "stg_orders"
        strategy = "IMPUTE_NULLS"
        target_file = "dbt/models/staging/stg_orders.sql"
    elif "payments" in target_table or "duplicate" in state.get("raw_error", "").lower():
        model_name = "stg_payments"
        strategy = "DEDUPLICATE_WINDOW_FUNCTION"
        target_file = "dbt/models/staging/stg_payments.sql"
    else:
        model_name = recommended_fix.get("target_file", "stg_orders").replace(".sql", "").split("/")[-1]
        strategy = recommended_fix.get("strategy", "GENERIC_RETRY")
        target_file = f"dbt/models/staging/{model_name}.sql"

    # Read existing model SQL
    model_data = read_dbt_model_code(model_name)
    original_sql = model_data.get("sql_code", "")

    patched_sql = original_sql
    explanation = ""

    # 1. Patch Schema Drift on stg_customers.sql
    if model_name == "stg_customers" or strategy == "RENAME_COLUMN_ALIAS":
        if "customer_zip_code_prefix as zip_code" in original_sql:
            patched_sql = original_sql.replace(
                "customer_zip_code_prefix as zip_code,",
                "coalesce(postal_code_drifted, customer_zip_code_prefix) as zip_code,"
            )
            explanation = (
                "Added backward-compatible coalesce alias for 'postal_code_drifted' "
                "to gracefully handle upstream schema column renaming."
            )
        else:
            patched_sql = (
                "with source as (\n"
                "    select * from {{ source('raw', 'customers') }}\n"
                ")\n\n"
                "select\n"
                "    customer_id,\n"
                "    customer_unique_id,\n"
                "    coalesce(postal_code_drifted, customer_zip_code_prefix) as zip_code,\n"
                "    customer_city as city,\n"
                "    customer_state as state\n"
                "from source\n"
            )
            explanation = "Rebuilt model selection with coalesce alias for drifted column."

    # 2. Patch Null Spike on stg_orders.sql
    elif model_name == "stg_orders" or strategy == "IMPUTE_NULLS":
        if "order_status," in original_sql:
            patched_sql = original_sql.replace(
                "order_status,",
                "coalesce(order_status, 'unknown') as order_status,"
            )
            explanation = (
                "Applied COALESCE imputation on 'order_status' replacing NULLs "
                "with default value 'unknown' to preserve data pipeline contracts."
            )
        else:
            patched_sql = original_sql

    # 3. Patch Duplicate Rows on stg_payments.sql
    elif model_name == "stg_payments" or strategy == "DEDUPLICATE_WINDOW_FUNCTION":
        patched_sql = (
            "with source as (\n"
            "    select * from {{ source('raw', 'payments') }}\n"
            "),\n\n"
            "deduplicated as (\n"
            "    select\n"
            "        order_id,\n"
            "        payment_sequential,\n"
            "        payment_type,\n"
            "        payment_installments,\n"
            "        payment_value,\n"
            "        row_number() over (\n"
            "            partition by order_id, payment_sequential\n"
            "            order by payment_value desc\n"
            "        ) as rn\n"
            "    from source\n"
            ")\n\n"
            "select\n"
            "    order_id,\n"
            "    payment_sequential,\n"
            "    payment_type,\n"
            "    payment_installments,\n"
            "    cast(payment_value as numeric(10, 2)) as payment_value\n"
            "from deduplicated\n"
            "where rn = 1\n"
        )
        explanation = (
            "Applied ROW_NUMBER() window partitioning on composite key (order_id, payment_sequential) "
            "to filter out duplicate webhook transaction records."
        )

    patch_diff = generate_diff(original_sql, patched_sql, f"{model_name}.sql")

    return ModelPatchModel(
        model_name=model_name,
        target_file=target_file,
        strategy=strategy,
        original_code=original_sql,
        patched_code=patched_sql,
        patch_diff=patch_diff,
        explanation=explanation
    )
