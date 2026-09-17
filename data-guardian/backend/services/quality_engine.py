"""
Data Quality & Anomaly Detection Engine for DataGuardian.
Executes statistical quality assertion checks across database tables (raw, staging, core)
and autonomously emits incident records into PostgreSQL dataops.incidents for the AI Agent.
"""

import os
import datetime
import json
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Ensure backend/services is importable
try:
    from backend.services.quality_rules import QualityRule, DEFAULT_QUALITY_RULES
except ImportError:
    try:
        from quality_rules import QualityRule, DEFAULT_QUALITY_RULES
    except ImportError:
        import sys
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        from quality_rules import QualityRule, DEFAULT_QUALITY_RULES

load_dotenv()

POSTGRES_USER = os.getenv("POSTGRES_USER", "data_guardian")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "guardian_pass")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "data_guardian_db")


def get_engine():
    """Returns a SQLAlchemy engine connected to PostgreSQL."""
    connection_url = (
        f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@"
        f"{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
    )
    return create_engine(connection_url)


@dataclass
class QualityCheckResult:
    rule: QualityRule
    status: str              # 'PASSED', 'FAILED', 'ERROR'
    actual_value: Any
    expected_threshold: Any
    message: str
    details: Dict[str, Any]
    incident_id: Optional[str] = None


def _safe_str(e: Any) -> str:
    """Safely converts exceptions to string, handling Windows locale encoding errors."""
    try:
        return str(e)
    except Exception:
        try:
            return repr(e)
        except Exception:
            return "Connection error (check PostgreSQL service)"


class QualityEngine:
    def __init__(self, engine=None):
        self.engine = engine or get_engine()

    def _split_table_name(self, full_table_name: str):
        """Splits 'schema.table' or defaults schema to 'raw'."""
        if "." in full_table_name:
            schema, table = full_table_name.split(".", 1)
        else:
            schema, table = "raw", full_table_name
        return schema, table

    def evaluate_rule(self, conn, rule: QualityRule) -> QualityCheckResult:
        """Dispatches rule evaluation based on rule_type."""
        schema, table = self._split_table_name(rule.table_name)

        try:
            if rule.rule_type == "schema_drift":
                return self._check_schema_drift(conn, schema, table, rule)
            elif rule.rule_type == "null_rate":
                return self._check_null_rate(conn, schema, table, rule)
            elif rule.rule_type == "volume_bounds":
                return self._check_volume_bounds(conn, schema, table, rule)
            elif rule.rule_type == "duplicate_rate":
                return self._check_duplicate_rate(conn, schema, table, rule)
            elif rule.rule_type == "value_range":
                return self._check_value_range(conn, schema, table, rule)
            else:
                return QualityCheckResult(
                    rule=rule,
                    status="ERROR",
                    actual_value=None,
                    expected_threshold=None,
                    message=f"Unsupported rule type: {rule.rule_type}",
                    details={}
                )
        except Exception as e:
            err_msg = _safe_str(e)
            return QualityCheckResult(
                rule=rule,
                status="ERROR",
                actual_value=None,
                expected_threshold=None,
                message=f"Database execution error on rule {rule.rule_id}: {err_msg}",
                details={"error": err_msg}
            )

    def _check_schema_drift(self, conn, schema: str, table: str, rule: QualityRule) -> QualityCheckResult:
        required_cols = rule.params.get("required_columns", [])
        sql = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = :schema AND table_name = :table;
        """)
        rows = conn.execute(sql, {"schema": schema, "table": table}).fetchall()
        existing_cols = {r[0].lower() for r in rows}
        missing_cols = [c for c in required_cols if c.lower() not in existing_cols]

        if not missing_cols:
            return QualityCheckResult(
                rule=rule,
                status="PASSED",
                actual_value=f"{len(existing_cols)} columns present",
                expected_threshold=f"All {len(required_cols)} required columns exist",
                message=f"Schema contract verified for {schema}.{table}.",
                details={"existing_columns": list(existing_cols)}
            )
        else:
            return QualityCheckResult(
                rule=rule,
                status="FAILED",
                actual_value=f"Missing {len(missing_cols)} columns: {missing_cols}",
                expected_threshold=f"Required columns: {required_cols}",
                message=f"Schema Drift Detected in {schema}.{table}! Missing required column(s): {', '.join(missing_cols)}",
                details={"missing_columns": missing_cols, "existing_columns": list(existing_cols)}
            )

    def _check_null_rate(self, conn, schema: str, table: str, rule: QualityRule) -> QualityCheckResult:
        col = rule.column_name
        max_rate = rule.params.get("max_null_rate", 0.0)

        sql = text(f"""
            SELECT 
                COUNT(*) AS total_rows,
                COUNT(*) FILTER (WHERE {col} IS NULL) AS null_rows
            FROM {schema}.{table};
        """)
        row = conn.execute(sql).fetchone()
        total_rows, null_rows = row[0], row[1]
        actual_rate = (null_rows / total_rows) if total_rows > 0 else 0.0

        details = {"total_rows": total_rows, "null_rows": null_rows, "actual_rate": actual_rate}

        if actual_rate <= max_rate:
            return QualityCheckResult(
                rule=rule,
                status="PASSED",
                actual_value=f"{actual_rate*100:.2f}% ({null_rows}/{total_rows})",
                expected_threshold=f"<= {max_rate*100:.2f}%",
                message=f"Null check passed for {schema}.{table}.{col}.",
                details=details
            )
        else:
            return QualityCheckResult(
                rule=rule,
                status="FAILED",
                actual_value=f"{actual_rate*100:.2f}% ({null_rows}/{total_rows})",
                expected_threshold=f"<= {max_rate*100:.2f}%",
                message=(
                    f"Null rate anomaly in {schema}.{table}.{col}: "
                    f"{actual_rate*100:.2f}% nulls found ({null_rows}/{total_rows}), exceeding threshold of {max_rate*100:.2f}%."
                ),
                details=details
            )

    def _check_volume_bounds(self, conn, schema: str, table: str, rule: QualityRule) -> QualityCheckResult:
        min_rows = rule.params.get("min_rows", 0)
        max_rows = rule.params.get("max_rows", float("inf"))

        sql = text(f"SELECT COUNT(*) FROM {schema}.{table};")
        total_rows = conn.execute(sql).scalar() or 0

        details = {"total_rows": total_rows, "min_rows": min_rows, "max_rows": max_rows}

        if min_rows <= total_rows <= max_rows:
            return QualityCheckResult(
                rule=rule,
                status="PASSED",
                actual_value=f"{total_rows:,} rows",
                expected_threshold=f"[{min_rows:,}, {max_rows:,}]",
                message=f"Volume check passed for {schema}.{table} ({total_rows:,} rows).",
                details=details
            )
        else:
            return QualityCheckResult(
                rule=rule,
                status="FAILED",
                actual_value=f"{total_rows:,} rows",
                expected_threshold=f"[{min_rows:,}, {max_rows:,}]",
                message=(
                    f"Volume anomaly in {schema}.{table}: "
                    f"Found {total_rows:,} rows, which is outside the expected bound [{min_rows:,}, {max_rows:,}]."
                ),
                details=details
            )

    def _check_duplicate_rate(self, conn, schema: str, table: str, rule: QualityRule) -> QualityCheckResult:
        cols = rule.column_name
        max_rate = rule.params.get("max_duplicate_rate", 0.0)

        # Count duplicate entries
        sql = text(f"""
            SELECT 
                COUNT(*) AS total_rows,
                COUNT(*) - COUNT(DISTINCT ({cols})) AS duplicate_rows
            FROM {schema}.{table};
        """)
        row = conn.execute(sql).fetchone()
        total_rows, duplicate_rows = row[0], row[1]
        actual_rate = (duplicate_rows / total_rows) if total_rows > 0 else 0.0

        details = {"total_rows": total_rows, "duplicate_rows": duplicate_rows, "actual_rate": actual_rate}

        if actual_rate <= max_rate:
            return QualityCheckResult(
                rule=rule,
                status="PASSED",
                actual_value=f"{actual_rate*100:.2f}% ({duplicate_rows}/{total_rows})",
                expected_threshold=f"<= {max_rate*100:.2f}%",
                message=f"Duplicate check passed for {schema}.{table} on ({cols}).",
                details=details
            )
        else:
            return QualityCheckResult(
                rule=rule,
                status="FAILED",
                actual_value=f"{actual_rate*100:.2f}% ({duplicate_rows}/{total_rows})",
                expected_threshold=f"<= {max_rate*100:.2f}%",
                message=(
                    f"Duplicate records anomaly in {schema}.{table} on ({cols}): "
                    f"{duplicate_rows} duplicate rows ({actual_rate*100:.2f}%) detected."
                ),
                details=details
            )

    def _check_value_range(self, conn, schema: str, table: str, rule: QualityRule) -> QualityCheckResult:
        col = rule.column_name
        min_val = rule.params.get("min_value")
        max_val = rule.params.get("max_value")

        conditions = []
        if min_val is not None:
            conditions.append(f"{col} < {min_val}")
        if max_val is not None:
            conditions.append(f"{col} > {max_val}")

        filter_clause = " OR ".join(conditions) if conditions else "1=0"

        sql = text(f"""
            SELECT 
                COUNT(*) AS total_rows,
                COUNT(*) FILTER (WHERE {filter_clause}) AS out_of_bound_rows
            FROM {schema}.{table}
            WHERE {col} IS NOT NULL;
        """)
        row = conn.execute(sql).fetchone()
        total_rows, out_of_bound = row[0], row[1]

        details = {"total_rows": total_rows, "out_of_bound_rows": out_of_bound, "min_val": min_val, "max_val": max_val}

        if out_of_bound == 0:
            return QualityCheckResult(
                rule=rule,
                status="PASSED",
                actual_value=f"0 out-of-bounds rows",
                expected_threshold=f"Range: min={min_val}, max={max_val}",
                message=f"Value range check passed for {schema}.{table}.{col}.",
                details=details
            )
        else:
            return QualityCheckResult(
                rule=rule,
                status="FAILED",
                actual_value=f"{out_of_bound} out-of-bounds rows",
                expected_threshold=f"Range: min={min_val}, max={max_val}",
                message=(
                    f"Value range violation in {schema}.{table}.{col}: "
                    f"{out_of_bound} records fell outside expected range [min={min_val}, max={max_val}]."
                ),
                details=details
            )

    def emit_incident(self, result: QualityCheckResult) -> Optional[str]:
        """
        Emits an incident record into dataops.incidents and dataops.agent_audit_log
        so the AI Agent can immediately initiate Root Cause Analysis (RCA).
        """
        now = datetime.datetime.now(datetime.timezone.utc)
        timestamp_str = now.strftime("%Y%m%d_%H%M%S")
        safe_table = result.rule.table_name.replace(".", "_")
        incident_id = f"INC_DQ_{safe_table}_{result.rule.rule_id}_{timestamp_str}"
        result.incident_id = incident_id

        error_summary = (
            f"[DATA QUALITY ANOMALY DETECTED]\n"
            f"Rule ID: {result.rule.rule_id}\n"
            f"Table: {result.rule.table_name}\n"
            f"Rule Type: {result.rule.rule_type}\n"
            f"Severity: {result.rule.severity}\n"
            f"Expected: {result.expected_threshold}\n"
            f"Actual: {result.actual_value}\n"
            f"Diagnostic Message: {result.message}\n"
            f"Timestamp: {now.isoformat()}"
        )

        try:
            with self.engine.begin() as conn:
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
                    "pipeline_name": f"quality_engine_{safe_table}",
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
                        'ANOMALY_DETECTED',
                        'DataQualityEngine',
                        CAST(:tool_input AS jsonb),
                        CAST(:tool_output AS jsonb),
                        :reasoning_summary,
                        :timestamp
                    );
                """)
                tool_input = json.dumps({
                    "rule_id": result.rule.rule_id,
                    "table_name": result.rule.table_name,
                    "rule_type": result.rule.rule_type,
                    "params": result.rule.params
                })
                tool_output = json.dumps({
                    "status": result.status,
                    "actual_value": str(result.actual_value),
                    "expected_threshold": str(result.expected_threshold),
                    "details": {k: (v if not isinstance(v, set) else list(v)) for k, v in result.details.items()}
                })

                conn.execute(insert_audit_sql, {
                    "incident_id": incident_id,
                    "tool_input": tool_input,
                    "tool_output": tool_output,
                    "reasoning_summary": f"DataQualityEngine detected {result.rule.severity} violation: {result.message}",
                    "timestamp": now
                })

            print(f"[ALERT - DataGuardian] Incident {incident_id} registered in dataops.incidents.")
            return incident_id
        except Exception as e:
            err_msg = _safe_str(e)
            print(f"[WARN - DataGuardian] Could not persist incident to DB (Postgres may be offline): {err_msg}")
            return incident_id

    def run_checks(self, rules: Optional[List[QualityRule]] = None, emit_on_failure: bool = True) -> Dict[str, Any]:
        """Runs all specified or default quality checks and returns an evaluation summary."""
        rules = rules or DEFAULT_QUALITY_RULES
        results: List[QualityCheckResult] = []

        passed_count = 0
        failed_count = 0
        error_count = 0

        try:
            with self.engine.connect() as conn:
                for rule in rules:
                    res = self.evaluate_rule(conn, rule)
                    if res.status == "FAILED":
                        failed_count += 1
                        if emit_on_failure:
                            self.emit_incident(res)
                    elif res.status == "PASSED":
                        passed_count += 1
                    else:
                        error_count += 1

                    results.append(res)
        except Exception as e:
            err_msg = _safe_str(e)
            print(f"[ERROR - DataGuardian] Failed to connect to database (check if PostgreSQL is running): {err_msg}")
            # If database cannot connect, record connection error for all rules
            for rule in rules:
                results.append(QualityCheckResult(
                    rule=rule,
                    status="ERROR",
                    actual_value=None,
                    expected_threshold=None,
                    message=f"Database connection unavailable (check if PostgreSQL is running): {err_msg}",
                    details={"error": err_msg}
                ))
            error_count = len(rules)

        return {
            "total_rules": len(rules),
            "passed": passed_count,
            "failed": failed_count,
            "errors": error_count,
            "results": results
        }
