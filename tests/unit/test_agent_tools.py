"""
Unit tests for the DataGuardian AI Agent Read-Only Toolset (Phase 7).
Tests postgres_tools, airflow_tools, and dbt_tools for safety, accuracy, and parsing.
"""

import os
import pytest
from unittest.mock import MagicMock

from agent.tools.postgres_tools import (
    list_tables,
    describe_table,
    execute_read_query,
    get_table_sample,
    MUTATION_KEYWORDS
)
from agent.tools.airflow_tools import (
    get_open_incidents,
    get_incident_details,
    get_pipeline_overview
)
from agent.tools.dbt_tools import (
    list_dbt_models,
    read_dbt_model_code,
    read_dbt_schema_contracts,
    get_model_dependencies
)


# --- Postgres Tools Tests ---

def test_execute_read_query_blocks_mutations():
    """Security Guardrail: Ensure mutation queries (DROP, DELETE, UPDATE, etc.) are blocked."""
    dangerous_queries = [
        "DROP TABLE raw.orders;",
        "DELETE FROM raw.customers WHERE customer_id = '123';",
        "UPDATE raw.payments SET payment_value = 0;",
        "TRUNCATE raw.products;",
        "ALTER TABLE raw.customers ADD COLUMN hack INT;",
        "INSERT INTO raw.orders VALUES ('x', 'y');",
        "GRANT ALL ON raw.orders TO public;"
    ]
    for dq in dangerous_queries:
        res = execute_read_query(dq)
        assert res["status"] == "ERROR"
        assert "Security Guardrail Violation" in res["error"]


def test_execute_read_query_allows_select_with_mock():
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn

    # Mock query result
    mock_cursor = MagicMock()
    mock_cursor.keys.return_value = ["id", "val"]
    mock_cursor.fetchmany.return_value = [(1, "test")]
    mock_conn.execute.return_value = mock_cursor

    res = execute_read_query("SELECT id, val FROM raw.test;", limit=10, engine=mock_engine)
    assert res["status"] == "SUCCESS"
    assert res["row_count"] == 1
    assert res["rows"][0]["id"] == 1


def test_list_tables_mocked():
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_conn.execute.return_value.fetchall.return_value = [("customers",), ("orders",)]

    res = list_tables(schema="raw", engine=mock_engine)
    assert res["status"] == "SUCCESS"
    assert res["count"] == 2
    assert "customers" in res["tables"]


def test_describe_table_mocked():
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_conn.execute.return_value.fetchall.return_value = [
        ("order_id", "character varying", "NO", None),
        ("order_status", "character varying", "YES", None)
    ]

    res = describe_table("orders", schema="raw", engine=mock_engine)
    assert res["status"] == "SUCCESS"
    assert res["column_count"] == 2
    assert res["columns"][0]["column_name"] == "order_id"


# --- Airflow Tools Tests ---

def test_get_open_incidents_mocked():
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn
    mock_conn.execute.return_value.fetchall.return_value = [
        ("INC_001", "ecommerce_pipeline", "OPEN", "Null spike error", None)
    ]

    res = get_open_incidents(engine=mock_engine)
    assert res["status"] == "SUCCESS"
    assert res["open_count"] == 1
    assert res["incidents"][0]["incident_id"] == "INC_001"


def test_get_pipeline_overview():
    res = get_pipeline_overview()
    assert res["status"] == "SUCCESS"
    assert res["task_count"] == 4
    task_ids = [t["task_id"] for t in res["tasks"]]
    assert "ingest_raw_data" in task_ids
    assert "dbt_test_quality" in task_ids


# --- dbt Tools Tests ---

def test_list_dbt_models_real_files():
    res = list_dbt_models()
    assert res["status"] == "SUCCESS"
    assert res["total_models"] >= 5
    model_names = [m["name"] for m in res["staging_models"] + res["core_models"]]
    assert "stg_orders" in model_names
    assert "dim_customers" in model_names


def test_read_dbt_model_code_real_files():
    res = read_dbt_model_code("stg_customers")
    assert res["status"] == "SUCCESS"
    assert "source('raw', 'customers')" in res["sql_code"]


def test_read_dbt_schema_contracts():
    res = read_dbt_schema_contracts()
    assert res["status"] == "SUCCESS"
    assert "models" in res["schema_definitions"]


def test_get_model_dependencies_lineage():
    # fact_orders references ref('stg_orders') and ref('stg_payments')
    res = get_model_dependencies("fact_orders")
    assert res["status"] == "SUCCESS"
    assert "stg_orders" in res["upstream_models"]
    assert "stg_payments" in res["upstream_models"]
