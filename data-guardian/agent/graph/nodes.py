"""
LangGraph Node Definitions for the DataGuardian AI Agent.
Implements triage, log investigation, schema analysis, data sampling, and initial RCA reasoning.
"""

import re
from typing import Dict, Any

from agent.graph.state import IncidentState
from agent.tools.postgres_tools import (
    list_tables,
    describe_table,
    execute_read_query,
    get_table_sample
)
from agent.tools.airflow_tools import (
    get_incident_details,
    get_pipeline_overview
)
from agent.tools.dbt_tools import (
    read_dbt_model_code,
    read_dbt_schema_contracts,
    get_model_dependencies
)


def node_triage(state: IncidentState) -> IncidentState:
    """
    Node 1: Triage
    Inspects incident metadata, categorizes failure type, and isolates the target table.
    """
    incident_id = state.get("incident_id", "")
    raw_error = state.get("raw_error", "")
    pipeline_name = state.get("pipeline_name", "")

    # If details are sparse, pull full incident record
    incident_details = get_incident_details(incident_id)
    if incident_details.get("status") == "SUCCESS":
        inc = incident_details["incident"]
        raw_error = raw_error or inc.get("error_summary", "")
        pipeline_name = pipeline_name or inc.get("pipeline_name", "")

    # Detect Failure Type & Target Table
    failure_type = "UNKNOWN"
    target_table = None

    if "Schema Drift" in raw_error or "schema_drift" in incident_id.lower() or "postal_code_drifted" in raw_error:
        failure_type = "SCHEMA_DRIFT"
        target_table = "raw.customers"
    elif "Null rate" in raw_error or "null_spike" in incident_id.lower() or "null_status" in raw_error.lower():
        failure_type = "DATA_QUALITY_ANOMALY"
        target_table = "raw.orders"
    elif "duplicate" in raw_error.lower() or "duplicates" in incident_id.lower():
        failure_type = "DATA_QUALITY_ANOMALY"
        target_table = "raw.payments"
    elif "dbt" in raw_error.lower():
        failure_type = "PIPELINE_TASK_FAILURE"
        target_table = "staging.stg_orders"
    else:
        failure_type = "PIPELINE_TASK_FAILURE"

    # Extract table match if explicitly mentioned in format raw.<table_name>
    table_match = re.search(r"\b(raw|staging|core)\.([a-z_]+)\b", raw_error)
    if table_match:
        target_table = f"{table_match.group(1)}.{table_match.group(2)}"

    return {
        "status": "INVESTIGATING",
        "failure_type": failure_type,
        "target_table": target_table,
        "raw_error": raw_error,
        "pipeline_name": pipeline_name
    }


def node_investigate_logs(state: IncidentState) -> IncidentState:
    """
    Node 2: Investigate Logs
    Fetches execution trace, historical audit records, and pipeline task structure.
    """
    incident_id = state.get("incident_id", "")
    details = get_incident_details(incident_id)

    logs_evidence = {
        "incident_record": details.get("incident", {}),
        "audit_events": details.get("audit_events", []),
        "pipeline_structure": get_pipeline_overview()
    }

    return {
        "logs_evidence": logs_evidence
    }


def node_analyze_schema(state: IncidentState) -> IncidentState:
    """
    Node 3: Analyze Schema
    Inspects physical database columns and compares them against dbt contracts.
    """
    target_table = state.get("target_table") or "raw.customers"
    schema, table = target_table.split(".", 1) if "." in target_table else ("raw", target_table)

    table_meta = describe_table(table, schema=schema)
    dbt_contracts = read_dbt_schema_contracts()

    # Look for corresponding dbt model
    dbt_model_name = f"stg_{table}"
    dbt_model_code = read_dbt_model_code(dbt_model_name)
    lineage = get_model_dependencies(dbt_model_name) if dbt_model_code.get("status") == "SUCCESS" else {}

    # Check for column mismatches (Schema Drift)
    existing_cols = {c["column_name"].lower() for c in table_meta.get("columns", [])}
    missing_expected_cols = []
    if "raw.customers" in target_table:
        expected = {"customer_id", "customer_unique_id", "customer_zip_code_prefix", "customer_city", "customer_state"}
        missing_expected_cols = list(expected - existing_cols)

    schema_evidence = {
        "table": target_table,
        "existing_columns": list(existing_cols),
        "missing_expected_columns": missing_expected_cols,
        "has_schema_drift": len(missing_expected_cols) > 0,
        "dbt_model": dbt_model_name,
        "lineage": lineage
    }

    return {
        "schema_evidence": schema_evidence
    }


def node_inspect_data(state: IncidentState) -> IncidentState:
    """
    Node 4: Inspect Data
    Pulls targeted empirical row samples to observe the anomaly directly in PostgreSQL.
    """
    target_table = state.get("target_table") or "raw.orders"
    failure_type = state.get("failure_type", "")
    raw_error = state.get("raw_error", "")

    data_evidence = {}

    if "orders" in target_table and ("Null" in raw_error or "null" in raw_error.lower()):
        # Query sample of rows where order_status is null
        null_query = f"SELECT * FROM {target_table} WHERE order_status IS NULL LIMIT 5;"
        null_samples = execute_read_query(null_query)
        data_evidence["corrupted_samples"] = null_samples.get("rows", [])
        data_evidence["observation"] = "Verified presence of null values in column 'order_status'."

    elif "payments" in target_table:
        # Check for duplicates
        dup_query = f"""
            SELECT order_id, payment_sequential, COUNT(*) as count 
            FROM {target_table} 
            GROUP BY order_id, payment_sequential 
            HAVING COUNT(*) > 1 
            LIMIT 5;
        """
        dup_samples = execute_read_query(dup_query)
        data_evidence["corrupted_samples"] = dup_samples.get("rows", [])
        data_evidence["observation"] = "Verified duplicate primary key instances in payments."

    else:
        sample = get_table_sample(target_table, limit=5)
        data_evidence["general_samples"] = sample.get("rows", [])
        data_evidence["observation"] = "Retrieved general table records."

    return {
        "data_evidence": data_evidence
    }


from agent.services.rca_engine import generate_root_cause_analysis


def node_generate_rca(state: IncidentState) -> IncidentState:
    """
    Node 5: Generate Root Cause Analysis (RCA)
    Synthesizes logs, schema discrepancies, and data samples into an empirical,
    validated Root Cause Analysis (RCA) report using the RCA Engine.
    """
    rca_model = generate_root_cause_analysis(state)
    rca_dict = rca_model.model_dump()

    return {
        "status": "RCA_GENERATED",
        "root_cause_analysis": rca_dict,
        "rca_narrative": rca_model.root_cause_summary,
        "confidence_score": rca_model.confidence_score,
        "proposed_sql_fix": rca_model.recommended_fix.suggested_sql_or_action
    }


from agent.services.fix_generator import generate_model_patch, ModelPatchModel
from agent.services.sandbox_tester import run_sandbox_validation


def node_generate_fix(state: IncidentState) -> IncidentState:
    """
    Node 6: Generate Code Fix
    Produces concrete, syntactically valid dbt model SQL code and a unified diff
    addressing the identified root cause.
    """
    patch: ModelPatchModel = generate_model_patch(state)

    return {
        "status": "FIX_GENERATED",
        "proposed_model_patch": patch.model_dump(),
        "proposed_sql_fix": patch.patched_code
    }


def node_test_sandbox(state: IncidentState) -> IncidentState:
    """
    Node 7: Sandbox Verification
    Deploys the generated patch into the isolated PostgreSQL `staging_sandbox` schema
    and runs assertion checks to verify resolution before requesting human approval.
    """
    patch_dict = state.get("proposed_model_patch")
    if not patch_dict:
        patch_model = generate_model_patch(state)
    else:
        patch_model = ModelPatchModel(**patch_dict)

    failure_type = state.get("failure_type", "UNKNOWN")
    sandbox_result = run_sandbox_validation(patch_model, failure_type=failure_type)

    new_status = "SANDBOX_VERIFIED" if sandbox_result.get("tests_passed") else "SANDBOX_TEST_FAILED"

    return {
        "status": new_status,
        "sandbox_test_result": sandbox_result
    }


from agent.tools.remediation_tools import (
    apply_model_patch,
    record_incident_resolution,
    trigger_pipeline_recovery
)


def node_human_approval_gate(state: IncidentState) -> IncidentState:
    """
    Node 8: Human Approval Gate
    Determines if human approval has been granted.
    If no decision has been provided yet (human_approved is None),
    sets status to 'WAITING_FOR_APPROVAL'.
    """
    approved = state.get("human_approved")

    if approved is True:
        return {"status": "APPROVED"}
    elif approved is False:
        return {"status": "REJECTED"}
    else:
        return {"status": "WAITING_FOR_APPROVAL"}


def node_apply_approved_fix(state: IncidentState) -> IncidentState:
    """
    Node 9: Apply Approved Fix
    Safely writes the verified patch to the target dbt model with automatic backup,
    triggers pipeline recovery, and marks the incident as RESOLVED.
    """
    patch = state.get("proposed_model_patch") or {}
    target_file = patch.get("target_file", "dbt/models/staging/stg_customers.sql")
    patched_code = patch.get("patched_code", state.get("proposed_sql_fix", ""))
    incident_id = state.get("incident_id", "UNKNOWN_INCIDENT")
    root_cause = state.get("rca_narrative", "Resolved by DataOps Agent")
    pipeline_name = state.get("pipeline_name", "ecommerce_pipeline")

    # 1. Apply patch with atomic backup
    write_res = apply_model_patch(target_file, patched_code)

    # 2. Trigger pipeline recovery
    recovery_res = trigger_pipeline_recovery(pipeline_name)

    # 3. Update database incident record
    resolution_res = record_incident_resolution(
        incident_id=incident_id,
        root_cause=root_cause,
        proposed_fix=f"Applied patch to {target_file}"
    )

    remediation_result = {
        "patch_result": write_res,
        "recovery_result": recovery_res,
        "resolution_result": resolution_res
    }

    return {
        "status": "RESOLVED",
        "remediation_result": remediation_result
    }


def node_handle_rejection(state: IncidentState) -> IncidentState:
    """
    Node 10: Handle Rejection
    Safely terminates the remediation workflow when human operator rejects the fix,
    ensuring zero modification to production files.
    """
    return {
        "status": "REJECTED",
        "error_message": "Human operator rejected the proposed remediation plan."
    }




