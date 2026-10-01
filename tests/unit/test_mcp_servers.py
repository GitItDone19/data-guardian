"""
Unit tests for DataGuardian MCP Servers (Phase 14).
Validates server initialization, tool registration, and tool invocation
for postgres_server, dbt_server, and airflow_server.
"""

import sys
import os
import json
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
import importlib.util

@pytest.fixture
def anyio_backend():
    return "asyncio"


# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def load_server_module(server_file: str):
    """Dynamically loads an MCP server module from mcp/servers/ to avoid namespace shadowing."""
    server_path = PROJECT_ROOT / "mcp" / "servers" / server_file
    spec = importlib.util.spec_from_file_location(server_file.replace(".py", ""), server_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.server


@pytest.fixture(scope="module")
def postgres_mcp():
    return load_server_module("postgres_server.py")


@pytest.fixture(scope="module")
def dbt_mcp():
    return load_server_module("dbt_server.py")


@pytest.fixture(scope="module")
def airflow_mcp():
    return load_server_module("airflow_server.py")


# =====================================================================
# 1. PostgreSQL MCP Server Tests
# =====================================================================

@pytest.mark.anyio
async def test_postgres_server_registration(postgres_mcp):
    """Verifies that postgres_server registers all required database inspection tools."""
    assert postgres_mcp.name == "dataguardian-postgres"
    tools = await postgres_mcp.list_tools()
    tool_names = [t.name for t in tools]
    
    expected_tools = [
        "postgres_list_tables",
        "postgres_describe_table",
        "postgres_get_table_sample",
        "postgres_safe_execute_query"
    ]
    for exp in expected_tools:
        assert exp in tool_names, f"Expected tool {exp} not registered in postgres_server"


@pytest.mark.anyio
async def test_postgres_safe_execute_query_blocks_mutations(postgres_mcp):
    """Ensures MCP postgres_safe_execute_query enforces mutation guardrails."""
    res = await postgres_mcp.call_tool(
        "postgres_safe_execute_query",
        {"sql_query": "DROP TABLE raw.orders;"}
    )
    # Result content is returned as serialized JSON text
    content_text = res.content[0].text
    parsed = json.loads(content_text)
    assert parsed["status"] == "ERROR"
    assert "Security Guardrail Violation" in parsed["error"]


@pytest.mark.anyio
async def test_postgres_describe_table_invocation(postgres_mcp):
    """Tests describe_table tool response schema handling."""
    with patch("agent.tools.postgres_tools.get_engine") as mock_engine_fn:
        mock_engine = MagicMock()
        mock_conn = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_conn
        mock_conn.execute.return_value.fetchall.return_value = [
            ("customer_id", "character varying", "NO", None),
            ("customer_city", "character varying", "YES", None)
        ]
        mock_engine_fn.return_value = mock_engine

        res = await postgres_mcp.call_tool(
            "postgres_describe_table",
            {"table_name": "customers", "schema": "raw"}
        )
        content_text = res.content[0].text
        data = json.loads(content_text)
        assert data["status"] == "SUCCESS"
        assert data["column_count"] == 2
        assert data["columns"][0]["column_name"] == "customer_id"


# =====================================================================
# 2. dbt MCP Server Tests
# =====================================================================

@pytest.mark.anyio
async def test_dbt_server_registration(dbt_mcp):
    """Verifies that dbt_server registers all required dbt models and contract inspection tools."""
    assert dbt_mcp.name == "dataguardian-dbt"
    tools = await dbt_mcp.list_tools()
    tool_names = [t.name for t in tools]
    
    expected_tools = [
        "dbt_list_models",
        "dbt_read_model_code",
        "dbt_read_schema_contracts",
        "dbt_get_model_dependencies"
    ]
    for exp in expected_tools:
        assert exp in tool_names, f"Expected tool {exp} not registered in dbt_server"


@pytest.mark.anyio
async def test_dbt_list_models_invocation(dbt_mcp):
    """Tests that dbt_list_models correctly identifies existing staging and core models."""
    res = await dbt_mcp.call_tool("dbt_list_models", {})
    data = json.loads(res.content[0].text)
    assert data["status"] == "SUCCESS"
    assert data["total_models"] > 0
    staging_names = [m["name"] for m in data["staging_models"]]
    assert "stg_customers" in staging_names


@pytest.mark.anyio
async def test_dbt_read_model_code_invocation(dbt_mcp):
    """Tests reading model code via dbt_read_model_code."""
    res = await dbt_mcp.call_tool(
        "dbt_read_model_code",
        {"model_name": "stg_customers"}
    )
    data = json.loads(res.content[0].text)
    assert data["status"] == "SUCCESS"
    assert "customer_id" in data["sql_code"]


@pytest.mark.anyio
async def test_dbt_get_model_dependencies(dbt_mcp):
    """Tests extraction of upstream ref() dependencies for a model."""
    res = await dbt_mcp.call_tool(
        "dbt_get_model_dependencies",
        {"model_name": "dim_customers"}
    )
    data = json.loads(res.content[0].text)
    assert data["status"] == "SUCCESS"
    assert "stg_customers" in data["upstream_models"]


# =====================================================================
# 3. Airflow MCP Server Tests
# =====================================================================

@pytest.mark.anyio
async def test_airflow_server_registration(airflow_mcp):
    """Verifies that airflow_server registers all pipeline and incident tools."""
    assert airflow_mcp.name == "dataguardian-airflow"
    tools = await airflow_mcp.list_tools()
    tool_names = [t.name for t in tools]
    
    expected_tools = [
        "airflow_get_open_incidents",
        "airflow_get_incident_details",
        "airflow_get_pipeline_overview"
    ]
    for exp in expected_tools:
        assert exp in tool_names, f"Expected tool {exp} not registered in airflow_server"


@pytest.mark.anyio
async def test_airflow_get_pipeline_overview_invocation(airflow_mcp):
    """Tests retrieving pipeline overview structure via MCP."""
    res = await airflow_mcp.call_tool(
        "airflow_get_pipeline_overview",
        {"dag_id": "ecommerce_pipeline"}
    )
    data = json.loads(res.content[0].text)
    assert data["status"] == "SUCCESS"
    assert data["dag_id"] == "ecommerce_pipeline"
    assert data["task_count"] == 4
    task_ids = [t["task_id"] for t in data["tasks"]]
    assert "ingest_raw_data" in task_ids
    assert "dbt_test_quality" in task_ids


@pytest.mark.anyio
async def test_airflow_get_incident_details_mocked(airflow_mcp):
    """Tests retrieving full incident details and audit trail with mock engine."""
    with patch("agent.tools.airflow_tools.get_engine") as mock_engine_fn:
        mock_engine = MagicMock()
        mock_conn = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_conn

        from datetime import datetime
        now = datetime.now()
        mock_conn.execute.return_value.fetchone.return_value = (
            "INC-TEST", "ecommerce_pipeline", "OPEN", "Schema drift detected",
            "Missing column", "Add column alias", now, now
        )
        mock_conn.execute.return_value.fetchall.return_value = []
        mock_engine_fn.return_value = mock_engine

        res = await airflow_mcp.call_tool(
            "airflow_get_incident_details",
            {"incident_id": "INC-TEST"}
        )
        data = json.loads(res.content[0].text)
        assert data["status"] == "SUCCESS"
        assert data["incident"]["incident_id"] == "INC-TEST"
        assert data["incident"]["status"] == "OPEN"
