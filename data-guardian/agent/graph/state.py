"""
Incident State Definition for the DataGuardian LangGraph Agent.
Defines the shared state dictionary passed across all nodes in the reasoning graph.
"""

from typing import TypedDict, Optional, List, Dict, Any


class IncidentState(TypedDict, total=False):
    # Incident Identification & Metadata
    incident_id: str
    pipeline_name: str
    failure_type: str            # 'PIPELINE_TASK_FAILURE', 'DATA_QUALITY_ANOMALY', 'SCHEMA_DRIFT'
    target_table: Optional[str]
    raw_error: str

    # Evidence Gathering State
    logs_evidence: Dict[str, Any]
    schema_evidence: Dict[str, Any]
    data_evidence: Dict[str, Any]
    dbt_evidence: Dict[str, Any]

    # Reasoning & Analysis Output
    root_cause_analysis: Optional[Dict[str, Any]]
    rca_narrative: Optional[str]
    confidence_score: Optional[float]

    # Proposed Fix & Sandbox Validation
    proposed_sql_fix: Optional[str]
    proposed_model_patch: Optional[Dict[str, Any]]
    sandbox_test_result: Optional[Dict[str, Any]]

    # Workflow & Approval Status
    status: str                  # 'TRIAGING', 'INVESTIGATING', 'RCA_GENERATED', 'SANDBOX_VERIFIED', 'WAITING_FOR_APPROVAL', 'RESOLVED', 'FAILED'
    human_approved: Optional[bool]
    remediation_result: Optional[Dict[str, Any]]
    error_message: Optional[str]
