"""
Airflow & Incident Diagnostic Tools for the DataGuardian AI Agent.
Allows the AI Agent to query active incidents from dataops.incidents,
read full error logs, trace execution history, and inspect DAG status.
"""

import os
from typing import List, Dict, Any, Optional
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

POSTGRES_USER = os.getenv("POSTGRES_USER", "data_guardian")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "guardian_pass")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "data_guardian_db")


def get_engine():
    connection_url = (
        f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@"
        f"{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
    )
    return create_engine(connection_url)


def _safe_str(e):
    try:
        return str(e)
    except Exception:
        try:
            return repr(e)
        except Exception:
            return "Database connection error"


def get_open_incidents(engine=None) -> Dict[str, Any]:
    """
    Fetches all currently OPEN or UNRESOLVED incidents from dataops.incidents.
    This serves as the starting triage tool for the AI Agent.
    """
    engine = engine or get_engine()
    sql = text("""
        SELECT 
            incident_id, 
            pipeline_name, 
            status, 
            error_summary, 
            created_at
        FROM dataops.incidents
        WHERE status = 'OPEN'
        ORDER BY created_at DESC;
    """)
    try:
        with engine.connect() as conn:
            rows = conn.execute(sql).fetchall()
            incidents = [
                {
                    "incident_id": r[0],
                    "pipeline_name": r[1],
                    "status": r[2],
                    "error_summary": r[3],
                    "created_at": r[4].isoformat() if r[4] else None
                }
                for r in rows
            ]
            return {"status": "SUCCESS", "open_count": len(incidents), "incidents": incidents}
    except Exception as e:
        return {"status": "ERROR", "error": _safe_str(e)}


def get_incident_details(incident_id: str, engine=None) -> Dict[str, Any]:
    """
    Retrieves full details, error logs, and associated audit log events for an incident.
    """
    engine = engine or get_engine()

    incident_sql = text("""
        SELECT 
            incident_id, pipeline_name, status, error_summary, 
            root_cause, proposed_fix, created_at, updated_at
        FROM dataops.incidents
        WHERE incident_id = :iid;
    """)

    audit_sql = text("""
        SELECT 
            log_id, action_type, tool_name, tool_input, 
            tool_output, reasoning_summary, timestamp
        FROM dataops.agent_audit_log
        WHERE incident_id = :iid
        ORDER BY timestamp ASC;
    """)

    try:
        with engine.connect() as conn:
            inc_row = conn.execute(incident_sql, {"iid": incident_id}).fetchone()
            if not inc_row:
                return {"status": "ERROR", "error": f"Incident not found: {incident_id}"}

            audit_rows = conn.execute(audit_sql, {"iid": incident_id}).fetchall()
            audit_events = [
                {
                    "log_id": a[0],
                    "action_type": a[1],
                    "tool_name": a[2],
                    "tool_input": a[3],
                    "tool_output": a[4],
                    "reasoning_summary": a[5],
                    "timestamp": a[6].isoformat() if a[6] else None
                }
                for a in audit_rows
            ]

            return {
                "status": "SUCCESS",
                "incident": {
                    "incident_id": inc_row[0],
                    "pipeline_name": inc_row[1],
                    "status": inc_row[2],
                    "error_summary": inc_row[3],
                    "root_cause": inc_row[4],
                    "proposed_fix": inc_row[5],
                    "created_at": inc_row[6].isoformat() if inc_row[6] else None,
                    "updated_at": inc_row[7].isoformat() if inc_row[7] else None,
                },
                "audit_events": audit_events
            }
    except Exception as e:
        return {"status": "ERROR", "error": _safe_str(e)}


def get_pipeline_overview(dag_id: str = "ecommerce_pipeline") -> Dict[str, Any]:
    """
    Returns the static structural overview and tasks of the primary Airflow pipeline.
    """
    tasks = [
        {"task_id": "ingest_raw_data", "type": "PythonOperator", "upstream": []},
        {"task_id": "dbt_run_staging", "type": "BashOperator", "upstream": ["ingest_raw_data"]},
        {"task_id": "dbt_run_core", "type": "BashOperator", "upstream": ["dbt_run_staging"]},
        {"task_id": "dbt_test_quality", "type": "BashOperator", "upstream": ["dbt_run_core"]}
    ]
    return {
        "status": "SUCCESS",
        "dag_id": dag_id,
        "schedule": "@daily",
        "task_count": len(tasks),
        "tasks": tasks
    }
