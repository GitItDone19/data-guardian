"""
Pydantic Schemas and Request/Response Models for DataGuardian FastAPI Backend.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field


class IncidentSummary(BaseModel):
    incident_id: str
    pipeline_name: str
    status: str
    error_summary: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class IncidentDetailResponse(BaseModel):
    incident_id: str
    pipeline_name: str
    status: str
    error_summary: Optional[str] = None
    root_cause: Optional[str] = None
    proposed_fix: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    audit_events: List[Dict[str, Any]] = Field(default_factory=list)
    root_cause_analysis: Optional[Dict[str, Any]] = None
    proposed_model_patch: Optional[Dict[str, Any]] = None
    sandbox_test_result: Optional[Dict[str, Any]] = None


class ApprovalRequest(BaseModel):
    action: Literal["approve", "reject"] = Field(..., description="Approval decision: 'approve' or 'reject'")
    reviewer_notes: Optional[str] = Field(default=None, description="Optional notes from the human operator")


class ApprovalResponse(BaseModel):
    incident_id: str
    action: str
    status: str
    message: str
    remediation_result: Optional[Dict[str, Any]] = None


class SimulationRequest(BaseModel):
    scenario: Literal["null_spike", "schema_drift", "duplicates", "reset"] = Field(
        ...,
        description="Scenario to execute: 'null_spike', 'schema_drift', 'duplicates', or 'reset'"
    )


class SimulationResponse(BaseModel):
    status: str
    scenario: str
    message: str
    details: Optional[Dict[str, Any]] = None


class PipelineTaskInfo(BaseModel):
    task_id: str
    type: str
    upstream: List[str]


class PipelineStatusResponse(BaseModel):
    dag_id: str
    status: str
    schedule: str
    task_count: int
    tasks: List[PipelineTaskInfo]
    open_incidents_count: int
    unresolved_incidents: List[IncidentSummary]
