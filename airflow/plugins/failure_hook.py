"""
Airflow failure callback hook for DataGuardian.
When any task in an Airflow DAG fails, this hook is invoked to:
1. Extract error details and execution context.
2. Insert an incident record into the PostgreSQL `dataops.incidents` table.
3. Add an entry to `dataops.agent_audit_log` so the AI Agent can trigger Root Cause Analysis (RCA).
"""

import os
import datetime
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

def record_incident_on_failure(context):
    """
    Airflow task failure callback.
    Expected signature: callable(context: dict)
    """
    try:
        task_instance = context.get("task_instance")
        task_id = task_instance.task_id if task_instance else "unknown_task"
        dag_id = context.get("dag").dag_id if context.get("dag") else "unknown_dag"
        run_id = context.get("run_id", "manual_run")
        exception = context.get("exception")

        now = datetime.datetime.now(datetime.timezone.utc)
        timestamp_str = now.strftime("%Y%m%d_%H%M%S")
        incident_id = f"INC_{dag_id}_{task_id}_{timestamp_str}"

        error_message = str(exception) if exception else f"Task {task_id} failed in run {run_id}."
        
        # Format comprehensive error summary for Agent triage
        error_summary = (
            f"Pipeline: {dag_id}\n"
            f"Failed Task: {task_id}\n"
            f"Run ID: {run_id}\n"
            f"Timestamp: {now.isoformat()}\n"
            f"Exception Details:\n{error_message}"
        )

        print(f"\n[ALERT - DataGuardian] Task Failure Detected: {task_id}")
        print(f"[ALERT - DataGuardian] Registering Incident ID: {incident_id}")

        engine = get_engine()
        with engine.begin() as conn:
            # 1. Insert into dataops.incidents
            insert_incident_sql = text("""
                INSERT INTO dataops.incidents (
                    incident_id,
                    pipeline_name,
                    status,
                    error_summary,
                    created_at,
                    updated_at
                ) VALUES (
                    :incident_id,
                    :pipeline_name,
                    'OPEN',
                    :error_summary,
                    :created_at,
                    :updated_at
                )
                ON CONFLICT (incident_id) DO UPDATE SET
                    error_summary = EXCLUDED.error_summary,
                    updated_at = EXCLUDED.updated_at;
            """)

            conn.execute(insert_incident_sql, {
                "incident_id": incident_id,
                "pipeline_name": dag_id,
                "error_summary": error_summary,
                "created_at": now,
                "updated_at": now
            })

            # 2. Insert into dataops.agent_audit_log
            insert_audit_sql = text("""
                INSERT INTO dataops.agent_audit_log (
                    incident_id,
                    action_type,
                    tool_name,
                    tool_input,
                    tool_output,
                    reasoning_summary,
                    timestamp
                ) VALUES (
                    :incident_id,
                    'INCIDENT_DETECTED',
                    'AirflowFailureHook',
                    CAST(:tool_input AS jsonb),
                    CAST(:tool_output AS jsonb),
                    :reasoning_summary,
                    :timestamp
                );
            """)

            import json
            tool_input = json.dumps({"dag_id": dag_id, "task_id": task_id, "run_id": run_id})
            tool_output = json.dumps({"status": "INCIDENT_RECORDED", "incident_id": incident_id})

            conn.execute(insert_audit_sql, {
                "incident_id": incident_id,
                "tool_input": tool_input,
                "tool_output": tool_output,
                "reasoning_summary": f"Automated Airflow failure hook caught error on task '{task_id}'. Initialized incident for Agent RCA.",
                "timestamp": now
            })

        print(f"[SUCCESS - DataGuardian] Incident {incident_id} successfully persisted in dataops.incidents\n")
        return incident_id

    except Exception as e:
        try:
            err_str = str(e)
        except UnicodeDecodeError:
            err_str = repr(e)
        print(f"[ERROR - DataGuardian] Failed to log incident to database (DB might be offline): {err_str}")
        return None

if __name__ == "__main__":
    # Test execution with dummy context
    class DummyTaskInstance:
        task_id = "test_failure_task"

    class DummyDag:
        dag_id = "test_dag"

    test_context = {
        "task_instance": DummyTaskInstance(),
        "dag": DummyDag(),
        "run_id": "manual_test_run",
        "exception": RuntimeError("Simulated test error in pipeline quality test.")
    }
    record_incident_on_failure(test_context)
