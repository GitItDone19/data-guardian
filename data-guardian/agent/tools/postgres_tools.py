"""
PostgreSQL Read-Only Tools for the DataGuardian AI Agent.
Allows the AI Agent to inspect database schemas, table structures, and safely execute
read-only diagnostic SELECT queries without accidental data mutation.
"""

import os
import re
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


def list_tables(schema: str = "raw", engine=None) -> Dict[str, Any]:
    """Lists all tables present within a specific PostgreSQL schema."""
    engine = engine or get_engine()
    sql = text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = :schema
        ORDER BY table_name;
    """)
    try:
        with engine.connect() as conn:
            rows = conn.execute(sql, {"schema": schema}).fetchall()
            tables = [r[0] for r in rows]
            return {"status": "SUCCESS", "schema": schema, "tables": tables, "count": len(tables)}
    except Exception as e:
        return {"status": "ERROR", "schema": schema, "error": _safe_str(e)}


def describe_table(table_name: str, schema: str = "raw", engine=None) -> Dict[str, Any]:
    """
    Returns column names, data types, and nullability constraints for a table.
    Accepts 'schema.table' or separate schema and table arguments.
    """
    if "." in table_name:
        schema, table_name = table_name.split(".", 1)

    engine = engine or get_engine()
    sql = text("""
        SELECT 
            column_name, 
            data_type, 
            is_nullable,
            column_default
        FROM information_schema.columns 
        WHERE table_schema = :schema AND table_name = :table
        ORDER BY ordinal_position;
    """)
    try:
        with engine.connect() as conn:
            rows = conn.execute(sql, {"schema": schema, "table": table_name}).fetchall()
            columns = [
                {
                    "column_name": r[0],
                    "data_type": r[1],
                    "is_nullable": r[2],
                    "default": r[3]
                }
                for r in rows
            ]
            return {
                "status": "SUCCESS",
                "table": f"{schema}.{table_name}",
                "columns": columns,
                "column_count": len(columns)
            }
    except Exception as e:
        return {"status": "ERROR", "table": f"{schema}.{table_name}", "error": _safe_str(e)}


# Disallowed SQL statement keywords for security guardrail
MUTATION_KEYWORDS = [
    r"\bDROP\b", r"\bDELETE\b", r"\bUPDATE\b", r"\bINSERT\b",
    r"\bALTER\b", r"\bTRUNCATE\b", r"\bGRANT\b", r"\bREVOKE\b",
    r"\bCREATE\b", r"\bREPLACE\b"
]


def execute_read_query(query: str, limit: int = 50, engine=None) -> Dict[str, Any]:
    """
    Executes a read-only SELECT query against PostgreSQL with strict safety guardrails.
    Rejects any destructive or mutation statements (INSERT, UPDATE, DELETE, DROP, ALTER).
    """
    cleaned_query = query.strip()

    # Safety Guardrail: check for mutation keywords
    for pattern in MUTATION_KEYWORDS:
        if re.search(pattern, cleaned_query, re.IGNORECASE):
            return {
                "status": "ERROR",
                "error": f"Security Guardrail Violation: Mutating SQL keywords not allowed in read query: {pattern}"
            }

    # Ensure query starts with SELECT or WITH
    if not re.match(r"^(SELECT|WITH)\b", cleaned_query, re.IGNORECASE):
        return {
            "status": "ERROR",
            "error": "Security Guardrail Violation: Only SELECT or WITH queries are permitted."
        }

    engine = engine or get_engine()
    try:
        with engine.connect() as conn:
            result = conn.execute(text(cleaned_query))
            keys = list(result.keys()) if hasattr(result, "keys") else []
            rows = [dict(zip(keys, row)) for row in result.fetchmany(limit)]
            return {
                "status": "SUCCESS",
                "row_count": len(rows),
                "columns": keys,
                "rows": rows
            }
    except Exception as e:
        return {"status": "ERROR", "error": _safe_str(e)}


def get_table_sample(table_name: str, schema: str = "raw", limit: int = 5, engine=None) -> Dict[str, Any]:
    """Fetches a sample of records from a table for empirical inspection."""
    if "." in table_name:
        schema, table_name = table_name.split(".", 1)

    query = f"SELECT * FROM {schema}.{table_name} LIMIT {limit};"
    return execute_read_query(query, limit=limit, engine=engine)


def execute_write_query(query: str, engine=None) -> Dict[str, Any]:
    """
    Executes a DDL or DML write query (e.g. for sandbox views/tables creation).
    Commits the transaction upon completion.
    """
    engine = engine or get_engine()
    try:
        with engine.begin() as conn:
            conn.execute(text(query))
            return {"status": "SUCCESS"}
    except Exception as e:
        return {"status": "ERROR", "error": _safe_str(e)}

