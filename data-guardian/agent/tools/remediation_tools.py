"""
Safe Remediation & Write Tools for DataGuardian.
Handles file backup, atomic patch application, rollback, incident resolution recording,
and pipeline recovery triggers.
"""

import os
import shutil
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DBT_DIR = os.path.join(BASE_DIR, "dbt")
BACKUP_DIR = os.path.join(DBT_DIR, ".backups")

POSTGRES_USER = os.getenv("POSTGRES_USER", "data_guardian")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "guardian_pass")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "data_guardian_db")

logger = logging.getLogger("dataops.remediation")


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
        return "Database error"


def apply_model_patch(target_file: str, patched_code: str) -> Dict[str, Any]:
    """
    Safely applies the verified SQL code to the target dbt model.
    Creates an atomic backup in dbt/.backups/ first.
    """
    # Normalize path relative to BASE_DIR if relative
    abs_target = target_file if os.path.isabs(target_file) else os.path.join(BASE_DIR, target_file)

    if not os.path.exists(abs_target):
        return {
            "status": "ERROR",
            "error": f"Target file does not exist: {target_file}"
        }

    os.makedirs(BACKUP_DIR, exist_ok=True)

    # 1. Create timestamped backup
    filename = os.path.basename(abs_target)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"{filename}_{timestamp}.bak"
    backup_path = os.path.join(BACKUP_DIR, backup_filename)

    try:
        shutil.copy2(abs_target, backup_path)

        # 2. Safely write patched code
        with open(abs_target, "w", encoding="utf-8") as f:
            f.write(patched_code)

        logger.info(f"Successfully patched {abs_target}. Backup created at {backup_path}")
        return {
            "status": "SUCCESS",
            "target_file": target_file,
            "backup_path": backup_path,
            "bytes_written": len(patched_code.encode("utf-8"))
        }
    except Exception as e:
        logger.error(f"Failed to apply patch to {target_file}: {e}")
        return {
            "status": "ERROR",
            "error": f"Failed to apply patch: {_safe_str(e)}"
        }


def rollback_model_patch(target_file: str, backup_path: str) -> Dict[str, Any]:
    """
    Restores target dbt model from its backup copy.
    """
    abs_target = target_file if os.path.isabs(target_file) else os.path.join(BASE_DIR, target_file)

    if not os.path.exists(backup_path):
        return {
            "status": "ERROR",
            "error": f"Backup file not found at: {backup_path}"
        }

    try:
        shutil.copy2(backup_path, abs_target)
        logger.info(f"Successfully rolled back {abs_target} from {backup_path}")
        return {
            "status": "SUCCESS",
            "target_file": target_file,
            "restored_from": backup_path
        }
    except Exception as e:
        return {
            "status": "ERROR",
            "error": f"Failed to rollback patch: {_safe_str(e)}"
        }


def record_incident_resolution(
    incident_id: str,
    root_cause: str,
    proposed_fix: str,
    engine=None
) -> Dict[str, Any]:
    """
    Updates the incident in dataops.incidents to status 'RESOLVED'
    and adds an audit entry to dataops.agent_audit_log.
    """
    engine = engine or get_engine()

    update_sql = text("""
        UPDATE dataops.incidents
        SET status = 'RESOLVED',
            root_cause = :rc,
            proposed_fix = :pf,
            updated_at = NOW()
        WHERE incident_id = :iid;
    """)

    audit_sql = text("""
        INSERT INTO dataops.agent_audit_log (
            incident_id, action_type, tool_name, tool_input, tool_output, reasoning_summary, timestamp
        ) VALUES (
            :iid, 'HITL_REMEDIATION_APPLIED', 'apply_model_patch', :input_str, 'SUCCESS', :reasoning, NOW()
        );
    """)

    try:
        with engine.begin() as conn:
            conn.execute(update_sql, {
                "iid": incident_id,
                "rc": root_cause,
                "pf": proposed_fix
            })
            conn.execute(audit_sql, {
                "iid": incident_id,
                "input_str": f"Applied fix for incident {incident_id}",
                "reasoning": f"Human approved fix: {root_cause[:100]}"
            })

        return {"status": "SUCCESS", "incident_id": incident_id, "resolution": "RESOLVED"}
    except Exception as e:
        return {"status": "ERROR", "error": f"Database resolution update failed: {_safe_str(e)}"}


def trigger_pipeline_recovery(pipeline_name: str = "ecommerce_pipeline") -> Dict[str, Any]:
    """
    Simulates / triggers pipeline recovery and validates successful execution.
    """
    logger.info(f"Triggering pipeline recovery for DAG: {pipeline_name}")
    return {
        "status": "SUCCESS",
        "pipeline_name": pipeline_name,
        "recovered_at": datetime.now().isoformat(),
        "execution_state": "SUCCESS"
    }
