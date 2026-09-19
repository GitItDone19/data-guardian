"""
REST API Routes for DataGuardian FastAPI Backend.
Connects Next.js Frontend Dashboard to Database, LangGraph Agent, and Simulation Tools.
"""

import os
import sys
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import text

from backend.api.schemas import (
    IncidentSummary,
    IncidentDetailResponse,
    ApprovalRequest,
    ApprovalResponse,
    SimulationRequest,
    SimulationResponse,
    PipelineStatusResponse,
    PipelineTaskInfo
)
from agent.tools.airflow_tools import (
    get_engine,
    get_open_incidents,
    get_incident_details,
    get_pipeline_overview
)
from agent.graph.graph import build_dataops_graph
from agent.graph.state import IncidentState

# Simulation imports
try:
    from scripts.simulate_incident import (
        inject_null_spike,
        inject_schema_drift,
        inject_duplicates,
        reset_clean_data
    )
except ImportError:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if BASE_DIR not in sys.path:
        sys.path.append(BASE_DIR)
    from scripts.simulate_incident import (
        inject_null_spike,
        inject_schema_drift,
        inject_duplicates,
        reset_clean_data
    )

logger = logging.getLogger("dataops.api")
router = APIRouter(prefix="/api")

# Singleton agent compiled with MemorySaver
agent_app = build_dataops_graph()


@router.get("/health", tags=["System"])
def health_check():
    """Health check endpoint confirming API service is operational."""
    return {"status": "HEALTHY", "service": "DataGuardian FastAPI Backend"}


@router.get("/pipelines/status", response_model=PipelineStatusResponse, tags=["Pipelines"])
def get_pipelines_status():
    """Returns overview of pipeline DAGs, execution tasks, and active incident volume."""
    dag_overview = get_pipeline_overview("ecommerce_pipeline")
    open_inc = get_open_incidents()
    incidents = open_inc.get("incidents", [])

    return PipelineStatusResponse(
        dag_id=dag_overview.get("dag_id", "ecommerce_pipeline"),
        status="DEGRADED" if len(incidents) > 0 else "HEALTHY",
        schedule=dag_overview.get("schedule", "@daily"),
        task_count=dag_overview.get("task_count", 4),
        tasks=[
            PipelineTaskInfo(
                task_id=t["task_id"],
                type=t["type"],
                upstream=t["upstream"]
            )
            for t in dag_overview.get("tasks", [])
        ],
        open_incidents_count=len(incidents),
        unresolved_incidents=[
            IncidentSummary(
                incident_id=i["incident_id"],
                pipeline_name=i["pipeline_name"],
                status=i["status"],
                error_summary=i.get("error_summary"),
                created_at=i.get("created_at")
            )
            for i in incidents
        ]
    )


@router.get("/incidents", response_model=List[IncidentSummary], tags=["Incidents"])
def list_incidents(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by incident status")
):
    """Lists incidents with optional status filtering."""
    engine = get_engine()
    sql_base = """
        SELECT incident_id, pipeline_name, status, error_summary, created_at, updated_at
        FROM dataops.incidents
    """
    params = {}
    if status_filter:
        sql_base += " WHERE status = :st"
        params["st"] = status_filter.upper()
    sql_base += " ORDER BY created_at DESC;"

    try:
        with engine.connect() as conn:
            rows = conn.execute(text(sql_base), params).fetchall()
            return [
                IncidentSummary(
                    incident_id=r[0],
                    pipeline_name=r[1],
                    status=r[2],
                    error_summary=r[3],
                    created_at=r[4].isoformat() if r[4] else None,
                    updated_at=r[5].isoformat() if r[5] else None
                )
                for r in rows
            ]
    except Exception as e:
        logger.error(f"Error listing incidents: {e}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")


@router.get("/incidents/{incident_id}", response_model=IncidentDetailResponse, tags=["Incidents"])
def get_incident(incident_id: str):
    """Retrieves full details, audit trail, and diagnostics for a specific incident."""
    details = get_incident_details(incident_id)
    if details.get("status") == "ERROR":
        raise HTTPException(status_code=404, detail=details.get("error", "Incident not found"))

    inc = details["incident"]
    return IncidentDetailResponse(
        incident_id=inc["incident_id"],
        pipeline_name=inc["pipeline_name"],
        status=inc["status"],
        error_summary=inc.get("error_summary"),
        root_cause=inc.get("root_cause"),
        proposed_fix=inc.get("proposed_fix"),
        created_at=inc.get("created_at"),
        updated_at=inc.get("updated_at"),
        audit_events=details.get("audit_events", [])
    )


@router.post("/incidents/{incident_id}/triage", tags=["Agent Operations"])
def triage_incident(incident_id: str):
    """
    Triggers the LangGraph agent thread to investigate an incident, perform RCA,
    generate a patch, and validate it in the staging_sandbox schema.
    Pauses at WAITING_FOR_APPROVAL.
    """
    details = get_incident_details(incident_id)
    if details.get("status") == "ERROR":
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found.")

    inc = details["incident"]

    initial_state: IncidentState = {
        "incident_id": inc["incident_id"],
        "pipeline_name": inc["pipeline_name"],
        "raw_error": inc.get("error_summary", ""),
        "human_approved": None  # Will pause at approval gate
    }

    config = {"configurable": {"thread_id": incident_id}}
    final_state = agent_app.invoke(initial_state, config=config)

    return {
        "status": final_state.get("status", "INVESTIGATING"),
        "incident_id": incident_id,
        "failure_type": final_state.get("failure_type"),
        "target_table": final_state.get("target_table"),
        "root_cause_analysis": final_state.get("root_cause_analysis"),
        "rca_narrative": final_state.get("rca_narrative"),
        "proposed_model_patch": final_state.get("proposed_model_patch"),
        "sandbox_test_result": final_state.get("sandbox_test_result"),
        "confidence_score": final_state.get("confidence_score")
    }


@router.post("/incidents/{incident_id}/approve", response_model=ApprovalResponse, tags=["Human In The Loop"])
def approve_incident_fix(incident_id: str, request: ApprovalRequest):
    """
    Handles human approval or rejection of a proposed patch.
    Resumes the LangGraph thread to apply the fix and resolve the incident.
    """
    if request.action == "reject":
        resume_state = {
            "incident_id": incident_id,
            "human_approved": False
        }
        config = {"configurable": {"thread_id": incident_id}}
        final_state = agent_app.invoke(resume_state, config=config)

        return ApprovalResponse(
            incident_id=incident_id,
            action="reject",
            status=final_state.get("status", "REJECTED"),
            message="Fix rejected by human operator. Production files remain unmodified."
        )

    # Approve action
    resume_state = {
        "incident_id": incident_id,
        "human_approved": True
    }
    config = {"configurable": {"thread_id": incident_id}}
    final_state = agent_app.invoke(resume_state, config=config)

    return ApprovalResponse(
        incident_id=incident_id,
        action="approve",
        status=final_state.get("status", "RESOLVED"),
        message="Fix approved and successfully applied. Pipeline recovered.",
        remediation_result=final_state.get("remediation_result")
    )


@router.post("/simulate", response_model=SimulationResponse, tags=["Simulation"])
def simulate_scenario(request: SimulationRequest):
    """
    Injects a realistic anomaly into PostgreSQL raw tables or resets to healthy baseline.
    Scenarios: 'null_spike', 'schema_drift', 'duplicates', or 'reset'.
    """
    scenario = request.scenario
    success = False
    message = ""

    try:
        if scenario == "null_spike":
            success = inject_null_spike()
            message = "Simulated high null spike (~45%) in raw.orders.order_status."
        elif scenario == "schema_drift":
            success = inject_schema_drift()
            message = "Simulated schema drift in raw.customers (postal_code_drifted)."
        elif scenario == "duplicates":
            success = inject_duplicates()
            message = "Simulated duplicate transaction rows in raw.payments."
        elif scenario == "reset":
            success = reset_clean_data()
            message = "Warehouse successfully restored to 100% clean baseline data."

        if not success:
            raise HTTPException(status_code=500, detail=f"Scenario '{scenario}' execution failed.")

        return SimulationResponse(
            status="SUCCESS",
            scenario=scenario,
            message=message
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Simulation execution error: {e}")
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")
